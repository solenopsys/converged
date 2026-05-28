/**
 * ms-audio-gate — root-mounted proxy plugin
 *
 * Routes:
 *   /audio-gate/*        → HTTP proxy → llm-audio-gate
 *   /audio-gate/ws       → WebSocket relay → llm-audio-gate /ws
 *
 * Env:
 *   LLM_GATE_URL  (default: http://127.0.0.1:8090)
 */
import { t } from "elysia";

// Headers that must never be forwarded upstream
const SKIP_HEADERS = new Set([
  "host",
  "connection",
  "upgrade",
  "sec-websocket-key",
  "sec-websocket-version",
  "sec-websocket-extensions",
  "sec-websocket-protocol",
]);

function filterHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of headers.entries()) {
    if (!SKIP_HEADERS.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

const plugin = (_config: any) => (app: any) => {
  const gateUrl = (process.env.LLM_GATE_URL ?? "http://127.0.0.1:8090").replace(/\/$/, "");

  // ── HTTP REST proxy ──────────────────────────────────────────────────
  app.all("/audio-gate/*", async ({ request, params }: any) => {
    const rest: string = params["*"] ?? "";
    const reqUrl = new URL(request.url);
    const target = `${gateUrl}/${rest}${reqUrl.search}`;

    const hasBody = !["GET", "HEAD"].includes(request.method.toUpperCase());

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: request.method,
        headers: filterHeaders(request.headers),
        body: hasBody ? request.body : undefined,
      });
    } catch (err) {
      console.error(`[audio-gate-proxy] fetch error → ${target}:`, err);
      return new Response(JSON.stringify({ ok: false, error: "gate_unreachable" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: filterHeaders(upstream.headers),
    });
  });

  // ── WebSocket relay ──────────────────────────────────────────────────
  app.ws("/audio-gate/ws", {
    query: t.Object({ user: t.Optional(t.String()) }),

    open(ws: any) {
      const user: string = ws.data?.query?.user ?? "";
      const wsBase = gateUrl.replace(/^http/, "ws");
      const upstreamUrl = `${wsBase}/ws${user ? `?user=${encodeURIComponent(user)}` : ""}`;

      const upstream = new WebSocket(upstreamUrl);
      ws._upstream = upstream;

      upstream.onmessage = (e: MessageEvent) => {
        try {
          ws.send(typeof e.data === "string" ? e.data : e.data);
        } catch {
          // client already closed
        }
      };

      upstream.onclose = () => {
        try { ws.close(); } catch { /* noop */ }
      };

      upstream.onerror = (err: Event) => {
        console.error("[audio-gate-proxy] upstream WS error:", err);
        try { ws.close(); } catch { /* noop */ }
      };
    },

    message(ws: any, message: string | ArrayBuffer) {
      const up: WebSocket | undefined = ws._upstream;
      if (up && up.readyState === WebSocket.OPEN) {
        up.send(message as string);
      }
    },

    close(ws: any) {
      const up: WebSocket | undefined = ws._upstream;
      up?.close();
      ws._upstream = undefined;
    },
  });

  return app;
};

plugin.mount = "root" as const;
export default plugin;
