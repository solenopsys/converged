/**
 * ms-audio-gate — root-mounted plugin
 *
 * Routes:
 *   /services/audiogate/*  → nrpc AudioGateService (phone numbers + llm-gate configs)
 *   /audio-gate/*          → HTTP proxy → llm-audio-gate
 *   /audio-gate/ws         → WebSocket relay → llm-audio-gate /ws
 *
 * Env: LLM_GATE_URL (optional — relay is disabled when unset; the config
 * service and its stores still come up so dev/seed works without the gate).
 */
import { t } from "elysia";
import { createHttpBackend } from "nrpc";
import { metadata } from "g-audio-gate";
import { AudioGateServiceImpl } from "./service";

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

const MAX_PENDING_WS_MESSAGES = 16;
type PendingWsMessage = string | ArrayBuffer;
type RelayState = {
	relayId: string;
	upstream: WebSocket;
	pendingMessages: PendingWsMessage[];
};
type RelaySocket = {
	id?: string | number;
	data?: {
		query?: { user?: string };
		audioGateRelay?: RelayState;
	};
	send: (message: PendingWsMessage) => void;
	close: () => void;
};
type AudioGateApp = {
	onRequest: (
		handler: (context: { request: Request }) => Promise<Response | undefined>,
	) => void;
	ws: (
		path: string,
		config: {
			query: unknown;
			open: (ws: RelaySocket) => void;
			message: (ws: RelaySocket, message: unknown) => void;
			close: (ws: RelaySocket) => void;
		},
	) => void;
};

const relayById = new Map<string, RelayState>();
const relayBySocket = new WeakMap<RelaySocket, RelayState>();

function filterHeaders(headers: Headers): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of headers.entries()) {
		if (!SKIP_HEADERS.has(k.toLowerCase())) out[k] = v;
	}
	return out;
}

function sendWsError(ws: RelaySocket, code: string, message: string): void {
	try {
		ws.send(JSON.stringify({ type: "error", data: { code, message } }));
	} catch {
		// client already closed
	}
}

function normalizeWsMessage(message: unknown): PendingWsMessage {
	if (typeof message === "string" || message instanceof ArrayBuffer) {
		return message;
	}

	return JSON.stringify(message);
}

function relayKey(ws: RelaySocket): string {
	return ws.id === undefined ? "" : String(ws.id);
}

function setRelayState(ws: RelaySocket, state: RelayState): void {
	const key = relayKey(ws);
	if (key) relayById.set(key, state);
	if (ws.data) ws.data.audioGateRelay = state;
	relayBySocket.set(ws, state);
}

function getRelayState(ws: RelaySocket): RelayState | undefined {
	const key = relayKey(ws);
	return (
		(key ? relayById.get(key) : undefined) ??
		ws.data?.audioGateRelay ??
		relayBySocket.get(ws)
	);
}

function deleteRelayState(ws: RelaySocket): void {
	const key = relayKey(ws);
	if (key) relayById.delete(key);
	if (ws.data) delete ws.data.audioGateRelay;
	relayBySocket.delete(ws);
}

// Shared instance: backs both the nrpc backend and (via its stores) anything
// else in this process. Stores are created in the constructor's init().
const serviceInstance = new AudioGateServiceImpl();
const nrpcBackend = createHttpBackend({
	metadata,
	serviceImpl: serviceInstance,
	// Mounted at app root, so prefix the routes to land under /services.
	pathPrefix: "/services",
});

const plugin = (config: any) => (app: AudioGateApp) => {
	// nrpc AudioGateService → /services/audiogate/* (registers its own
	// startup/shutdown tasks and brings up the phone-numbers store).
	nrpcBackend(config)(app as any);

	const gateUrl = process.env.LLM_GATE_URL?.replace(/\/$/, "") ?? "";
	if (!gateUrl) {
		console.warn(
			"[audio-gate-proxy] LLM_GATE_URL not set; HTTP/WS relay disabled (config service still active)",
		);
		return app;
	}

	// Elysia's global landing fallback wins over dynamic /audio-gate/* routes,
	// so intercept REST calls before route matching. /audio-gate/ws is handled
	// by the explicit WebSocket route below.
	app.onRequest(async ({ request }) => {
		const reqUrl = new URL(request.url);
		if (
			!reqUrl.pathname.startsWith("/audio-gate/") ||
			reqUrl.pathname === "/audio-gate/ws"
		) {
			return;
		}

		const rest = reqUrl.pathname.slice("/audio-gate/".length);
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
			return new Response(
				JSON.stringify({ ok: false, error: "gate_unreachable" }),
				{
					status: 502,
					headers: { "content-type": "application/json" },
				},
			);
		}

		return new Response(upstream.body, {
			status: upstream.status,
			headers: filterHeaders(upstream.headers),
		});
	});

	// ── WebSocket relay ──────────────────────────────────────────────────
	app.ws("/audio-gate/ws", {
		query: t.Object({ user: t.Optional(t.String()) }),

		open(ws: RelaySocket) {
			const user: string = ws.data?.query?.user ?? "";
			const wsBase = gateUrl.replace(/^http/, "ws");
			const upstreamUrl = `${wsBase}/ws${user ? `?user=${encodeURIComponent(user)}` : ""}`;
			const relayId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

			const upstream = new WebSocket(upstreamUrl);
			const state: RelayState = {
				relayId,
				upstream,
				pendingMessages: [],
			};
			setRelayState(ws, state);

			console.info(
				`[audio-gate-proxy] WS ${relayId} opening upstream → ${upstreamUrl}`,
			);

			upstream.onopen = () => {
				const pending = state.pendingMessages;
				state.pendingMessages = [];
				console.info(
					`[audio-gate-proxy] WS ${relayId} upstream open, flushing ${pending.length} queued message(s)`,
				);
				for (const message of pending) {
					upstream.send(message);
				}
			};

			upstream.onmessage = (e: MessageEvent) => {
				try {
					ws.send(
						typeof e.data === "string" || e.data instanceof ArrayBuffer
							? e.data
							: String(e.data),
					);
				} catch {
					// client already closed
				}
			};

			upstream.onclose = (event: CloseEvent) => {
				console.info(
					`[audio-gate-proxy] WS ${relayId} upstream closed code=${event.code} reason=${event.reason || "-"}`,
				);
				deleteRelayState(ws);
				try {
					ws.close();
				} catch {
					/* noop */
				}
			};

			upstream.onerror = (err: Event) => {
				console.error(`[audio-gate-proxy] WS ${relayId} upstream error:`, err);
				sendWsError(
					ws,
					"upstream_ws_error",
					"Audio gate websocket upstream failed",
				);
				try {
					ws.close();
				} catch {
					/* noop */
				}
			};
		},

		message(ws: RelaySocket, message: unknown) {
			const state = getRelayState(ws);
			const payload = normalizeWsMessage(message);

			if (!state) {
				sendWsError(
					ws,
					"upstream_missing",
					"Audio gate websocket upstream is not initialized",
				);
				return;
			}

			const up = state.upstream;
			const relayId = state.relayId;

			if (up.readyState === WebSocket.OPEN) {
				up.send(payload);
				return;
			}

			if (up.readyState === WebSocket.CONNECTING) {
				if (state.pendingMessages.length >= MAX_PENDING_WS_MESSAGES) {
					console.error(
						`[audio-gate-proxy] WS ${relayId} pending queue overflow`,
					);
					sendWsError(
						ws,
						"upstream_queue_overflow",
						"Audio gate websocket upstream did not open in time",
					);
					try {
						ws.close();
					} catch {
						/* noop */
					}
					return;
				}

				state.pendingMessages.push(payload);
				console.info(
					`[audio-gate-proxy] WS ${relayId} queued message while upstream is connecting (${state.pendingMessages.length})`,
				);
				return;
			}

			sendWsError(
				ws,
				"upstream_not_open",
				`Audio gate websocket upstream is not open (${up.readyState})`,
			);
		},

		close(ws: RelaySocket) {
			const state = getRelayState(ws);
			state?.upstream.close();
			deleteRelayState(ws);
		},
	});

	return app;
};

plugin.mount = "root" as const;
export default plugin;
