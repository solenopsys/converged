// server.ts — plain Bun server без фреймворков
// запустить:  bun run server.ts

const PORT = 3333;

// === статика ===
const DIST_DIR = new URL("./dist/", import.meta.url).pathname;
const HTML_DIR = new URL("./html/", import.meta.url).pathname;
const SPA_ENTRY = HTML_DIR + "landing-demo.html";
const STORE_WORKERS_DIRS = [
  new URL("../../public/front/libraries/store-workers/dist/", import.meta.url).pathname,
  new URL("../../../converged-portal/front/libraries/store-workers/dist/", import.meta.url).pathname,
];

// === опциональный прокси ===
const ENABLE_PROXY = true;                        // поставь true если нужно
const BACKEND_ORIGIN = "http://localhost:3001";
const PROXY_TIMEOUT_MS = 10000;
const FORWARDED_METHODS_WITH_BODY = new Set(["POST","PUT","PATCH","DELETE"]);

// — утилита: попытаться отдать файл, если он существует
async function tryServeFile(path: string, method: string): Promise<Response | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;

  // Для HEAD: только заголовки без тела
  if (method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Length": String(file.size ?? 0),
        "Cache-Control": cacheControl(path),
        "Last-Modified": file.lastModified ? new Date(file.lastModified).toUTCString() : undefined,
        "ETag": await file.hash?.("sha1") ?? undefined,
      },
    });
  }

  return new Response(file.stream(), {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": cacheControl(path),
      "Last-Modified": file.lastModified ? new Date(file.lastModified).toUTCString() : undefined,
      "ETag": await file.hash?.("sha1") ?? undefined,
    },
  });
}

// — кэш: для /dist агрессивнее, для html помягче
function cacheControl(path: string) {
  if (path.includes("/dist/")) return "public, max-age=31536000, immutable";
  return "public, max-age=60";
}

// — безопасная нормализация пути без выхода выше директории
function safeJoin(root: string, reqPath: string) {
  const urlPath = new URL("file://" + root + "/" + reqPath.replace(/^\/+/, ""));
  return urlPath.pathname;
}

// — прокси (опционально)
async function maybeProxy(req: Request): Promise<Response | null> {
  if (!ENABLE_PROXY) return null;

  const url = new URL(req.url);

  const targetConfig = (() => {
    if (url.pathname.startsWith("/services/") || url.pathname.startsWith("/cache/blob")) {
      const targetPath = url.pathname || "/";
      return {
        url: new URL(targetPath + url.search, BACKEND_ORIGIN),
        host: new URL(BACKEND_ORIGIN).host,
      };
    }



    return null;
  })();

  if (!targetConfig) {
    return null;
  }

  // прокидываем заголовки (можно подчистить лишние при желании)
  const headers = new Headers(req.headers);
  headers.set("host", targetConfig.host);

  const method = req.method.toUpperCase();
  let body: ArrayBuffer | undefined;
  if (FORWARDED_METHODS_WITH_BODY.has(method)) {
    try {
      body = await req.arrayBuffer();
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return new Response(JSON.stringify({ message: "Client aborted request" }), {
          status: 499,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw error;
    }
  }

  const abortController = new AbortController();
  const onAbort = () => abortController.abort();
  const timeoutId = setTimeout(onAbort, PROXY_TIMEOUT_MS);
  req.signal?.addEventListener("abort", onAbort);

  try {
    const resp = await fetch(targetConfig.url, {
      method,
      headers,
      body,
      // AbortSignal.timeout есть в Bun
      signal: abortController.signal,
    });

    // Отдаём как есть (стрим)
    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    });
  } catch (err: any) {
    if (req.signal?.aborted) {
      return new Response(JSON.stringify({ message: "Client aborted request" }), {
        status: 499,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      return new Response(JSON.stringify({ message: "Proxy timeout", ms: PROXY_TIMEOUT_MS }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ message: "Proxy error", detail: String(err) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    clearTimeout(timeoutId);
    req.signal?.removeEventListener("abort", onAbort);
  }
}

const server = Bun.serve({
  port: PORT,
  idleTimeout: 30, // короче idle, чтобы не “зависал” keep-alive коннектами

  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();

    // 1) Проксирование (если включено)
    const proxied = await maybeProxy(req);
    if (proxied) return proxied;

    // 2) Отдача store.worker.js из оригинальной директории store-workers
    if (url.pathname === "/dist/store.worker.js") {
      for (const workerDir of STORE_WORKERS_DIRS) {
        const workerPath = safeJoin(workerDir, "store.worker.js");
        const res = await tryServeFile(workerPath, method);
        if (res) return res;
      }
      return new Response("Worker not found", { status: 404 });
    }

    // 3) Отдача из /dist по явному префиксу
    if (url.pathname.startsWith("/dist/")) {
      const distPath = safeJoin(DIST_DIR, url.pathname.replace(/^\/dist\//, ""));
      const res = await tryServeFile(distPath, method);
      if (res) return res;
      return new Response("Not found", { status: 404 });
    }

    // 4) Прямая отдача из /html, если путь указывает на существующий файл
    const htmlCandidate = safeJoin(HTML_DIR, url.pathname);
    const direct = await tryServeFile(htmlCandidate, method);
    if (direct) return direct;

    // 5) SPA fallback → index.html (важно, чтобы файл реально существовал)
    const spa = await tryServeFile(SPA_ENTRY, method);
    if (spa) return spa;

    return new Response("index.html not found", { status: 500 });
  },
});

console.log(`🚀 Bun server listening http://localhost:${PORT}`);
console.log(`📦 Static: /dist -> ${DIST_DIR}`);
console.log(`📄 HTML:   / -> ${HTML_DIR}`);
console.log(`🧵 Worker: inlined into /dist/ai-chat.iife.js`);
console.log(`🔁 Proxy /services/*, /cache/blob* -> ${BACKEND_ORIGIN} (enabled: ${ENABLE_PROXY})`);
