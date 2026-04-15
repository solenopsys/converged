import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { CacheAdapter } from "../../back/back-core/src/server/createServer";
import { installBackendLogBridge } from "../../back/back-core/src/server/logBridge";
import { loadAiProvidersFromEnv } from "../../back/back-core/src/server/envConfig";
import { createValkeyCache } from "./valkey";

type RuntimeMap = {
  services: Record<string, string>;
  workflows?: {
    plugin?: string;
  };
  spa?: {
    plugin?: string;
  };
  landing?: {
    plugin?: string;
  };
  cache?: {
    url?: string;
    keyPrefix?: string;
    ssrTtlSeconds?: number;
  };
};

const appRoot = process.env.APP_ROOT || process.cwd();
const projectDir = process.env.PROJECT_DIR || appRoot;
const port = Number(process.env.PORT || "3000");
const dataRoot = process.env.DATA_DIR || resolve(appRoot, "data");
const runtimeMapPath =
  process.env.RUNTIME_MAP_PATH || resolve(appRoot, "runtime-map.toml");
const pluginsRoot = resolve(appRoot, "plugins");
const binLibsPath =
  process.env.BIN_LIBS_PATH || resolve(pluginsRoot, "bin-libs");

function readRuntimeMap(path: string): RuntimeMap {
  const content = readFileSync(path, "utf8");
  return Bun.TOML.parse(content) as RuntimeMap;
}

async function importPlugin(path: string) {
  const mod = await import(pathToFileURL(path).href);
  const plugin = mod.default ?? mod.plugin ?? mod;
  if (typeof plugin !== "function") {
    throw new Error(`Invalid plugin export at ${path}`);
  }
  return plugin as (cfg: any) => any;
}

process.env.BIN_LIBS_PATH = binLibsPath;
process.env.PROJECT_DIR = projectDir;
if (!process.env.SERVICES_BASE) {
  process.env.SERVICES_BASE = `http://127.0.0.1:${port}/services`;
}

async function generateServiceToken(secret: string): Promise<string> {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "service-account", perm: ["*/*( rw)"], iat: Math.floor(Date.now() / 1000) });
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${Buffer.from(sig).toString("base64url")}`;
}

if (!process.env.ACCESS_JWT_SECRET) {
  throw new Error("ACCESS_JWT_SECRET is not set");
}
process.env.SERVICE_TOKEN = await generateServiceToken(process.env.ACCESS_JWT_SECRET);

if (!existsSync(runtimeMapPath)) {
  throw new Error(`Runtime map not found: ${runtimeMapPath}`);
}

const runtimeMap = readRuntimeMap(runtimeMapPath);
const runtimeCacheConfig = runtimeMap.cache?.url
  ? {
      url: runtimeMap.cache.url,
      keyPrefix: runtimeMap.cache.keyPrefix,
      defaultTtlSeconds: runtimeMap.cache.ssrTtlSeconds,
    }
  : null;

if (runtimeCacheConfig?.url) {
  process.env.VALKEY_URL ||= runtimeCacheConfig.url;
}

const runtimeCache: CacheAdapter | undefined = runtimeCacheConfig
  ? createValkeyCache(runtimeCacheConfig)
  : undefined;
const logBridge = installBackendLogBridge({
  serviceBaseUrl: `http://127.0.0.1:${port}/services`,
  source: "back.runtime",
});

const pluginEntries: Array<{
  key: string;
  path: string;
  plugin: (cfg: any) => any;
}> = [];
const startupTasks: Array<{ name: string; task: () => Promise<void> }> = [];
const shutdownTasks: Array<{ name: string; task: () => Promise<void> }> = [];
for (const [key, mappedPath] of Object.entries(runtimeMap.services || {})) {
  const pluginPath = mappedPath.startsWith("/")
    ? mappedPath
    : resolve(appRoot, mappedPath);
  if (!existsSync(pluginPath)) {
    console.error("[runtime] mapped plugin file does not exist:", pluginPath);
    continue;
  }
  try {
    const plugin = await importPlugin(pluginPath);
    pluginEntries.push({ key, path: pluginPath, plugin });
  } catch (error) {
    console.error("[runtime] plugin import failed:", pluginPath, error);
  }
}

const servicePaths: Record<string, string> = {};
for (const { key } of pluginEntries) {
  const name = key.split("/")[1];
  if (name) servicePaths[name] = resolve(dataRoot, name);
}

let workflows: any = {};
if (runtimeMap.workflows?.plugin) {
  const wfPath = runtimeMap.workflows.plugin.startsWith("/")
    ? runtimeMap.workflows.plugin
    : resolve(appRoot, runtimeMap.workflows.plugin);
  if (existsSync(wfPath)) {
    try {
      workflows = await import(pathToFileURL(wfPath).href);
    } catch (error) {
      console.error("[runtime] workflows load failed:", wfPath, error);
      workflows = {};
    }
  }
}

const pluginConfig = {
  dbPath: dataRoot,
  dataDir: dataRoot,
  cache: runtimeCache,
  valkey: runtimeCache,
  registerStartupTask: (name: string, task: () => Promise<void>) => {
    startupTasks.push({ name, task });
  },
  registerShutdownTask: (name: string, task: () => Promise<void>) => {
    shutdownTasks.push({ name, task });
  },
  ...loadAiProvidersFromEnv(),
  servicePaths,
  workflows,
};

if (runtimeCache) {
  shutdownTasks.push({
    name: "valkey:close",
    task: async () => {
      runtimeCache.close();
    },
  });
}

const serveStatic = async (dir: string, path: string) => {
  const requested = path === "/" ? "/index.html" : path;
  const file = Bun.file(resolve(dir, `.${requested}`));
  if (await file.exists()) return file;
  const fallback = Bun.file(resolve(dir, "index.html"));
  if (await fallback.exists()) return fallback;
  return null;
};

const serveFile = async (absPath: string, request?: Request) => {
  const file = Bun.file(absPath);
  if (!(await file.exists())) return new Response("Not Found", { status: 404 });
  const accept = request?.headers.get("accept-encoding") ?? "";
  if (accept.includes("br")) {
    const brFile = Bun.file(absPath + ".br");
    if (await brFile.exists()) {
      const ct = file.type || "application/octet-stream";
      return new Response(brFile, {
        headers: {
          "Content-Type": ct,
          "Content-Encoding": "br",
          "Cache-Control": "no-store",
        },
      });
    }
  }
  return file;
};

const frontDir = resolve(appRoot, "dist/front");
const frontVendorDir = resolve(frontDir, "vendor");
const mfDir = resolve(appRoot, "dist/mf");
const landingPublicDir = resolve(appRoot, "front", "landing", "public");
const frontLocalesDir = resolve(appRoot, "front", "front-core", "locales");
const hasFront = (() => {
  try {
    return statSync(join(frontDir, "index.html")).isFile();
  } catch {
    return false;
  }
})();

const app = new Elysia()
  .use(cors({ origin: true }))
  .onAfterHandle(({ set }) => {
    // Override Vary: * set by CORS plugin — it prevents browser caching
    // of static assets loaded via <script type="module"> (Sec-Fetch-Mode: cors)
    if (set.headers["vary"] === "*") {
      set.headers["vary"] = "Accept-Encoding";
    }
  })
  .onError(({ error, path, code }) => {
    logBridge.enqueue({
      level: logBridge.level.error,
      code: logBridge.code.httpHandlerError,
      message: `[${code}] ${path}: ${error instanceof Error ? error.stack || error.message : String(error)}`,
    });
  })
  .get("/health", () => ({
    status: "ok",
    plugins: pluginEntries.length,
    timestamp: Date.now(),
  }))
  .group("/services", (api) => {
    for (const p of pluginEntries) {
      try {
        api.use(p.plugin(pluginConfig));
      } catch (err) {
        console.error("[runtime] plugin load failed:", p.path, err);
      }
    }
    return api;
  });

app
  .get("/vendor/*", async ({ params, request }) =>
    serveFile(resolve(frontVendorDir, params["*"] || ""), request),
  )
  .get("/mf/:name.js", async ({ params, request }) =>
    serveFile(resolve(mfDir, `${params.name}.js`), request),
  )
  .get("/front-core.js", async ({ request }) =>
    serveFile(resolve(frontDir, "index.js"), request),
  )
  .get("/favicon.svg", async () =>
    serveFile(resolve(landingPublicDir, "favicon.svg")),
  )
  .get("/locales/*", async ({ params }) =>
    serveFile(resolve(frontLocalesDir, params["*"] || "")),
  );

if (hasFront) {
  app
    .get("/console", async () => Bun.file(join(frontDir, "index.html")))
    .get("/console/*", async ({ params }) => {
      const result = await serveStatic(frontDir, `/${params["*"] || ""}`);
      return result ?? new Response("Not Found", { status: 404 });
    });
}

// SPA plugin — vendor libs, front-core, microfrontends
const spaPluginPath =
  runtimeMap.spa?.plugin ??
  (existsSync(resolve(pluginsRoot, "spa/plugin.js"))
    ? resolve(pluginsRoot, "spa/plugin.js")
    : resolve(projectDir, "front/spa/src/plugin.ts"));
if (existsSync(spaPluginPath)) {
  const spaPlugin = await importPlugin(spaPluginPath);
  app.use(
    spaPlugin({
      production: true,
      cache: runtimeCache,
    }),
  );
}

if (runtimeMap.landing?.plugin) {
  const landingPluginPath = runtimeMap.landing.plugin.startsWith("/")
    ? runtimeMap.landing.plugin
    : resolve(appRoot, runtimeMap.landing.plugin);
  if (!existsSync(landingPluginPath)) {
    throw new Error(`Landing plugin file does not exist: ${landingPluginPath}`);
  }
  const landingPlugin = await importPlugin(landingPluginPath);
  app.use(
    landingPlugin({
      production: true,
      publicDir: resolve(projectDir, "front", "landing", "public"),
    }),
  );
}

for (let i = 0; i < startupTasks.length; i++) {
  const startupTask = startupTasks[i];
  const startedAt = Date.now();
  console.log(
    `[runtime] Init ${i + 1}/${startupTasks.length} start: ${startupTask.name}`,
  );
  try {
    await startupTask.task();
    console.log(
      `[runtime] Init ${i + 1}/${startupTasks.length} done: ${startupTask.name} (${Date.now() - startedAt}ms)`,
    );
  } catch (error) {
    console.error(
      `[runtime] Init ${i + 1}/${startupTasks.length} failed: ${startupTask.name}`,
      error,
    );
    throw error;
  }
}

let shuttingDown = false;
const runShutdown = async (reason: string) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[runtime] Shutdown start (${reason})`);

  try {
    if (typeof (app as any).stop === "function") {
      (app as any).stop();
    }
  } catch (error) {
    console.error("[runtime] Failed to stop HTTP listener", error);
  }

  for (let i = shutdownTasks.length - 1; i >= 0; i--) {
    const shutdownTask = shutdownTasks[i];
    const startedAt = Date.now();
    console.log(
      `[runtime] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} start: ${shutdownTask.name}`,
    );
    try {
      await shutdownTask.task();
      console.log(
        `[runtime] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} done: ${shutdownTask.name} (${Date.now() - startedAt}ms)`,
      );
    } catch (error) {
      console.error(
        `[runtime] Shutdown ${shutdownTasks.length - i}/${shutdownTasks.length} failed: ${shutdownTask.name}`,
        error,
      );
    }
  }

  console.log("[runtime] Shutdown complete");
  await logBridge.flushNow();
};

process.once("SIGTERM", () => {
  void runShutdown("SIGTERM").finally(() => process.exit(0));
});
process.once("SIGINT", () => {
  void runShutdown("SIGINT").finally(() => process.exit(0));
});

app.listen({ port, hostname: "0.0.0.0" });
console.log(
  `[converged-app] http://localhost:${port} plugins=${pluginEntries.length}`,
);
