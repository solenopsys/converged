import { createEvent, createStore } from "effector";

export type SignalStatus = "idle" | "connecting" | "connected" | "reconnecting";

export type SignalEvent = {
	type: "event" | "error" | string;
	requestId?: string;
	name?: string;
	sessionId?: string;
	payload?: unknown;
	error?: { code?: string; message?: string } | string;
	[key: string]: unknown;
};

type SignalCommand = {
	type: "command";
	target: string;
	requestId: string;
	name: string;
	payload: unknown;
};

type Listener = (event: SignalEvent) => void;
export type SignalSocketFactory = (url: string) => WebSocket;
type PendingRequest = {
	resolve: (event: SignalEvent) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
};

const statusChanged = createEvent<SignalStatus>();
export const $signalStatus = createStore<SignalStatus>("idle").on(
	statusChanged,
	(_, status) => status,
);

declare global {
	var __FUJIN_WS_URL__: string | undefined;
}

function defaultSignalUrl(): string {
	if (globalThis.__FUJIN_WS_URL__) return globalThis.__FUJIN_WS_URL__;
	if (typeof window === "undefined") return "ws://localhost/signal/ws";
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/signal/ws`;
}

function errorFromEvent(event: SignalEvent): Error {
	if (typeof event.error === "string") return new Error(event.error);
	return new Error(
		event.error?.message || event.error?.code || "Signal request failed",
	);
}

const createWebSocket: SignalSocketFactory = (url) => new WebSocket(url);

export class SignalChannel {
	private socket: WebSocket | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private reconnectAttempt = 0;
	private stopped = false;
	private queue: SignalCommand[] = [];
	private pending = new Map<string, PendingRequest>();
	private requestListeners = new Map<string, Set<Listener>>();
	private eventListeners = new Map<string, Set<Listener>>();

	constructor(
		private readonly urlResolver: () => string = defaultSignalUrl,
		private readonly socketFactory: SignalSocketFactory = createWebSocket,
		private readonly connectionAvailable: () => boolean = () =>
			typeof window !== "undefined",
	) {}

	connect(): void {
		if (!this.connectionAvailable() || this.stopped) return;
		if (
			this.socket?.readyState === WebSocket.OPEN ||
			this.socket?.readyState === WebSocket.CONNECTING
		) {
			return;
		}

		statusChanged(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");
		const socket = this.socketFactory(this.urlResolver());
		this.socket = socket;

		socket.onopen = () => {
			if (this.socket !== socket) return;
			this.reconnectAttempt = 0;
			statusChanged("connected");
			this.startHeartbeat();
			this.flushQueue();
		};

		socket.onmessage = (message) => {
			if (typeof message.data !== "string") return;
			let event: SignalEvent;
			try {
				event = JSON.parse(message.data) as SignalEvent;
			} catch {
				return;
			}
			if (event.type === "ready" || event.type === "pong") return;
			this.dispatch(event);
		};

		socket.onerror = () => {
			// close drives one reconnect path and rejects in-flight requests.
		};

		socket.onclose = () => {
			if (this.socket !== socket) return;
			this.socket = null;
			this.stopHeartbeat();
			this.rejectPending(new Error("Signal connection was interrupted"));
			if (!this.stopped) this.scheduleReconnect();
		};
	}

	disconnect(): void {
		this.stopped = true;
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		this.reconnectTimer = null;
		this.stopHeartbeat();
		this.socket?.close();
		this.socket = null;
		this.rejectPending(new Error("Signal channel stopped"));
		statusChanged("idle");
	}

	reconnect(): void {
		this.stopped = false;
		this.socket?.close();
		this.socket = null;
		this.connect();
	}

	send(target: string, name: string, payload: unknown): string {
		const requestId = crypto.randomUUID();
		this.sendCommand({
			type: "command",
			target,
			requestId,
			name,
			payload,
		});
		return requestId;
	}

	request(
		target: string,
		name: string,
		payload: unknown,
		timeoutMs = 20_000,
	): Promise<SignalEvent> {
		const requestId = crypto.randomUUID();
		const command: SignalCommand = {
			type: "command",
			target,
			requestId,
			name,
			payload,
		};
		return new Promise<SignalEvent>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(requestId);
				reject(new Error(`Signal request timed out: ${name}`));
			}, timeoutMs);
			this.pending.set(requestId, { resolve, reject, timer });
			this.sendCommand(command);
		});
	}

	private sendCommand(command: SignalCommand): void {
		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(command));
		} else {
			this.queue.push(command);
			this.connect();
		}
	}

	subscribe(name: string, listener: Listener): () => void {
		return this.addListener(this.eventListeners, name, listener);
	}

	subscribeRequest(requestId: string, listener: Listener): () => void {
		return this.addListener(this.requestListeners, requestId, listener);
	}

	private dispatch(event: SignalEvent): void {
		if (event.requestId) {
			for (const listener of this.requestListeners.get(event.requestId) ?? []) {
				listener(event);
			}
			const pending = this.pending.get(event.requestId);
			if (pending) {
				clearTimeout(pending.timer);
				this.pending.delete(event.requestId);
				if (event.type === "error") pending.reject(errorFromEvent(event));
				else pending.resolve(event);
			}
		}
		if (event.name) {
			for (const listener of this.eventListeners.get(event.name) ?? []) {
				listener(event);
			}
		}
	}

	private addListener(
		registry: Map<string, Set<Listener>>,
		key: string,
		listener: Listener,
	): () => void {
		const listeners = registry.get(key) ?? new Set<Listener>();
		listeners.add(listener);
		registry.set(key, listeners);
		return () => {
			listeners.delete(listener);
			if (listeners.size === 0) registry.delete(key);
		};
	}

	private flushQueue(): void {
		const socket = this.socket;
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		const queued = this.queue;
		this.queue = [];
		for (const command of queued) socket.send(JSON.stringify(command));
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) return;
		const delay = Math.min(10_000, 500 * 2 ** this.reconnectAttempt);
		this.reconnectAttempt += 1;
		statusChanged("reconnecting");
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, delay);
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(() => {
			if (this.socket?.readyState === WebSocket.OPEN) {
				this.socket.send('{"type":"ping"}');
			}
		}, 20_000);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		this.heartbeatTimer = null;
	}

	private rejectPending(error: Error): void {
		for (const request of this.pending.values()) {
			clearTimeout(request.timer);
			request.reject(error);
		}
		this.pending.clear();
		this.queue = [];
	}
}

export const signalChannel = new SignalChannel();

if (typeof window !== "undefined") {
	queueMicrotask(() => signalChannel.connect());
}
