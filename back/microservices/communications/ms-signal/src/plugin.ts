import {
	resolveRequestScopeFromHeaders,
	resolveWorkspaceFromHeaders,
} from "back-core";
import { t } from "elysia";

const MAX_PENDING_MESSAGES = 64;
type WireMessage = string | ArrayBuffer;
type RelayState = {
	upstream: WebSocket;
	pending: WireMessage[];
};
type SignalSocket = {
	data?: {
		headers?: Record<string, string | undefined>;
		signalRelay?: RelayState;
	};
	send(message: WireMessage): void;
	close(): void;
};

function wireMessage(value: unknown): WireMessage {
	if (typeof value === "string" || value instanceof ArrayBuffer) return value;
	return JSON.stringify(value);
}

function sendError(socket: SignalSocket, code: string, message: string): void {
	socket.send(JSON.stringify({ type: "error", error: { code, message } }));
}

export function resolveSignalScope(
	headers: Record<string, string | undefined> | undefined,
	pinnedScope = process.env.STORAGE_SCOPE,
): string | undefined {
	return (
		resolveRequestScopeFromHeaders(headers) ??
		resolveWorkspaceFromHeaders(headers) ??
		(pinnedScope?.trim() || undefined)
	);
}

const plugin = () => (app: any) => {
	app.ws("/signal/ws", {
		query: t.Object({}),

		open(socket: SignalSocket) {
			const scope = resolveSignalScope(socket.data?.headers);
			if (!scope) {
				sendError(
					socket,
					"scope_required",
					"Storage scope could not be resolved",
				);
				socket.close();
				return;
			}

			const baseUrl = process.env.FUJIN_URL?.replace(/\/$/, "");
			if (!baseUrl) {
				sendError(socket, "signal_unavailable", "FUJIN_URL is not configured");
				socket.close();
				return;
			}

			const upstreamUrl = `${baseUrl.replace(/^http/, "ws")}/ws`;
			const upstream = new WebSocket(upstreamUrl, {
				headers: {
					"x-storage-scope": scope,
					scope,
					workspace: scope,
				},
			} as never);
			const state: RelayState = { upstream, pending: [] };
			if (socket.data) socket.data.signalRelay = state;

			upstream.onopen = () => {
				const pending = state.pending;
				state.pending = [];
				for (const message of pending) upstream.send(message);
			};
			upstream.onmessage = (event) => {
				socket.send(wireMessage(event.data));
			};
			upstream.onerror = () => {
				sendError(socket, "upstream_error", "Fujin connection failed");
			};
			upstream.onclose = () => socket.close();
		},

		message(socket: SignalSocket, message: unknown) {
			const state = socket.data?.signalRelay;
			if (!state) return;
			const payload = wireMessage(message);
			if (state.upstream.readyState === WebSocket.OPEN) {
				state.upstream.send(payload);
				return;
			}
			if (
				state.upstream.readyState === WebSocket.CONNECTING &&
				state.pending.length < MAX_PENDING_MESSAGES
			) {
				state.pending.push(payload);
				return;
			}
			sendError(socket, "upstream_not_open", "Fujin connection is not open");
			socket.close();
		},

		close(socket: SignalSocket) {
			socket.data?.signalRelay?.upstream.close();
			if (socket.data) delete socket.data.signalRelay;
		},
	});

	return app;
};

plugin.mount = "root" as const;
export default plugin;
