import type {
	WebSocketRequestMessage,
	WebSocketResponseMessage,
} from "nrpc/browser";
import {
	errorFromEvent,
	errorFromNrpcReply,
	eventFromPayload,
	isNrpcReply,
	type SignalEvent,
} from "./messages";
import { PendingMap } from "./pending";
import { statusChanged } from "./status";
import { StreamQueue } from "./stream-queue";
import { defaultSignalUrl } from "./url";

export type SignalSocketFactory = (url: string) => WebSocket;

/** The transport only needs a token provider; it does not own authentication. */
export type SignalAuthController = {
	/** Current token without starting an authentication flow. */
	getCurrentAccessToken(): string | null;

	/** Resolves a token for the first socket authentication. */
	getAccessToken(): Promise<string | null>;
	setTokens?(tokens: null): Promise<unknown> | unknown;
	subscribe(listener: () => void): () => void;
};

type Listener = (event: SignalEvent) => void;

type SignalCommand = {
	type: "command";
	target: string;
	requestId: string;
	name: string;
	payload: unknown;
};

const COMMAND_TIMEOUT_MS = 20_000;
const HEARTBEAT_INTERVAL_MS = 20_000;
const MAX_RECONNECT_DELAY_MS = 10_000;

const createWebSocket: SignalSocketFactory = (url) => new WebSocket(url);

export class SignalChannel {
	private socket: WebSocket | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private reconnectAttempt = 0;
	private stopped = false;
	private authRequired = false;
	private authenticated = false;
	private lastAuthToken: string | null = null;
	private queue: (SignalCommand | WebSocketRequestMessage)[] = [];
	private commandPending = new PendingMap<SignalEvent>();
	private envelopePending = new PendingMap<WebSocketResponseMessage>();
	private streams = new Map<string, StreamQueue<WebSocketResponseMessage>>();
	private requestListeners = new Map<string, Set<Listener>>();
	private eventListeners = new Map<string, Set<Listener>>();
	private auth: SignalAuthController | null;
	private unsubscribeAuth?: () => void;

	constructor(
		private readonly urlResolver: () => string = defaultSignalUrl,
		private readonly socketFactory: SignalSocketFactory = createWebSocket,
		private readonly connectionAvailable: () => boolean = () =>
			typeof WebSocket !== "undefined",
		auth?: SignalAuthController,
	) {
		this.auth = auth ?? null;
		this.subscribeToAuth();
	}

	setAuthController(auth: SignalAuthController | null): void {
		this.unsubscribeAuth?.();
		this.auth = auth;
		this.lastAuthToken = null;
		this.subscribeToAuth();
		this.sendCurrentAuth();
	}

	private subscribeToAuth(): void {
		this.unsubscribeAuth = this.auth?.subscribe(() => this.sendCurrentAuth());
	}

	// ── connection lifecycle ────────────────────────────────────────────────

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
		socket.onopen = () => this.handleOpen(socket);
		socket.onmessage = (message) => this.handleIncoming(message.data);
		socket.onerror = () => {
			// close drives one reconnect path and rejects in-flight requests.
		};
		socket.onclose = () => this.handleClose(socket);
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

	private handleOpen(socket: WebSocket): void {
		if (this.socket !== socket) return;
		this.reconnectAttempt = 0;
		statusChanged("connected");
		this.startHeartbeat();
		this.authRequired = false;
		this.authenticated = false;
		this.lastAuthToken = null;
	}

	private handleClose(socket: WebSocket): void {
		if (this.socket !== socket) return;
		this.socket = null;
		this.stopHeartbeat();
		this.rejectPending(new Error("Signal connection was interrupted"));
		if (!this.stopped) this.scheduleReconnect();
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) return;
		const delay = Math.min(
			MAX_RECONNECT_DELAY_MS,
			500 * 2 ** this.reconnectAttempt,
		);
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
		}, HEARTBEAT_INTERVAL_MS);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		this.heartbeatTimer = null;
	}

	// ── outgoing ────────────────────────────────────────────────────────────

	send(target: string, name: string, payload: unknown): string {
		const requestId = crypto.randomUUID();
		this.sendCommand({ type: "command", target, requestId, name, payload });
		return requestId;
	}

	request(
		target: string,
		name: string,
		payload: unknown,
		timeoutMs = COMMAND_TIMEOUT_MS,
	): Promise<SignalEvent> {
		const requestId = crypto.randomUUID();
		const reply = this.commandPending.wait(
			requestId,
			timeoutMs,
			() => new Error(`Signal request timed out: ${name}`),
		);
		this.sendCommand({ type: "command", target, requestId, name, payload });
		return reply;
	}

	requestEnvelope(
		message: WebSocketRequestMessage,
	): Promise<WebSocketResponseMessage> {
		const reply = this.envelopePending.wait(
			message.requestId,
			message.deadlineMs,
			() => new Error(`NRPC request timed out: ${message.method}`),
		);
		this.sendMessage(message);
		return reply;
	}

	requestEnvelopeStream(
		message: WebSocketRequestMessage,
	): AsyncIterable<WebSocketResponseMessage> {
		const queue = new StreamQueue<WebSocketResponseMessage>(() => {
			this.streams.delete(message.requestId);
		});
		this.streams.set(message.requestId, queue);
		this.sendMessage(message);
		return queue;
	}

	private sendCommand(command: SignalCommand): void {
		this.sendMessage({
			kind: "request",
			requestId: command.requestId,
			to: { target: command.target, service: command.target },
			method: command.name,
			codec: "json",
			deadlineMs: COMMAND_TIMEOUT_MS,
			payload: command.payload,
		});
	}

	private sendMessage(message: SignalCommand | WebSocketRequestMessage): void {
		if (this.socket?.readyState === WebSocket.OPEN && this.authenticated) {
			this.socket.send(JSON.stringify(message));
		} else {
			this.queue.push(message);
			this.connect();
		}
	}

	private flushQueue(): void {
		const socket = this.socket;
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		const queued = this.queue;
		this.queue = [];
		for (const message of queued) socket.send(JSON.stringify(message));
	}

	private async beginAuthentication(socket: WebSocket): Promise<void> {
		const token = await this.auth?.getAccessToken().catch(() => null);
		if (this.socket !== socket || socket.readyState !== WebSocket.OPEN) return;
		if (!token) {
			if (!this.authRequired) {
				this.authenticated = true;
				this.flushQueue();
			}
			return;
		}
		this.lastAuthToken = token;
		socket.send(JSON.stringify({ type: "auth", token }));
	}

	private sendCurrentAuth(): void {
		const socket = this.socket;
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		const token = this.auth?.getCurrentAccessToken() ?? null;
		if (!token || this.socket !== socket || token === this.lastAuthToken) return;
		this.lastAuthToken = token;
		socket.send(JSON.stringify({ type: "auth", token }));
	}

	// ── incoming ────────────────────────────────────────────────────────────

	private handleIncoming(data: unknown): void {
		if (typeof data !== "string") return;
		let event: SignalEvent | WebSocketResponseMessage;
		try {
			event = JSON.parse(data) as SignalEvent | WebSocketResponseMessage;
		} catch {
			return;
		}
		if (isNrpcReply(event)) {
			this.dispatchNrpcReply(event);
			return;
		}
		if (event.type === "ready") {
			this.authRequired = event.authRequired === true;
			this.authenticated = !this.authRequired;
			if (this.authenticated) this.flushQueue();
			if (this.socket) void this.beginAuthentication(this.socket);
			return;
		}
		if (event.type === "authenticated") {
			this.authenticated = true;
			this.flushQueue();
			return;
		}
		if (event.type === "auth_error") {
			this.authenticated = false;
			this.lastAuthToken = null;
			const socket = this.socket;
			socket?.close();
			void this.auth?.setTokens?.(null);
			return;
		}
		if (event.type === "pong") return;
		this.dispatchSignalEvent(event as SignalEvent);
	}

	private dispatchSignalEvent(event: SignalEvent): void {
		if (event.requestId) {
			this.notify(this.requestListeners, event.requestId, event);
			if (event.type === "error") {
				this.commandPending.reject(event.requestId, errorFromEvent(event));
			} else {
				this.commandPending.resolve(event.requestId, event);
			}
		}
		if (event.name) this.notify(this.eventListeners, event.name, event);
	}

	private dispatchNrpcReply(message: WebSocketResponseMessage): void {
		// Legacy command requests receive their reply as an NRPC envelope too.
		if (this.commandPending.has(message.requestId)) {
			this.settleCommand(message);
			return;
		}
		const stream = this.streams.get(message.requestId);
		if (stream) {
			this.feedStream(stream, message);
			return;
		}
		this.envelopePending.resolve(message.requestId, message);
	}

	private settleCommand(message: WebSocketResponseMessage): void {
		if (message.kind === "error") {
			this.commandPending.reject(
				message.requestId,
				errorFromNrpcReply(message),
			);
			return;
		}
		const event = eventFromPayload(message.payload);
		if (event) {
			this.notify(this.requestListeners, message.requestId, event);
			if (event.name) this.notify(this.eventListeners, event.name, event);
			this.commandPending.resolve(message.requestId, event);
			return;
		}
		this.commandPending.resolve(message.requestId, {
			type: "event",
			requestId: message.requestId,
			payload: message.payload,
		});
	}

	private feedStream(
		stream: StreamQueue<WebSocketResponseMessage>,
		message: WebSocketResponseMessage,
	): void {
		if (message.kind === "error") {
			this.streams.delete(message.requestId);
			stream.fail(errorFromNrpcReply(message));
			return;
		}
		if (message.kind !== "streamChunk") {
			this.streams.delete(message.requestId);
			stream.fail(new Error(`Unexpected NRPC stream reply: ${message.kind}`));
			return;
		}
		stream.push(message);
		if (message.fin) {
			this.streams.delete(message.requestId);
			stream.finish();
		}
	}

	// ── listeners ───────────────────────────────────────────────────────────

	subscribe(name: string, listener: Listener): () => void {
		return this.addListener(this.eventListeners, name, listener);
	}

	subscribeRequest(requestId: string, listener: Listener): () => void {
		return this.addListener(this.requestListeners, requestId, listener);
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

	private notify(
		registry: Map<string, Set<Listener>>,
		key: string,
		event: SignalEvent,
	): void {
		for (const listener of registry.get(key) ?? []) listener(event);
	}

	private rejectPending(error: Error): void {
		this.commandPending.rejectAll(error);
		this.envelopePending.rejectAll(error);
		for (const stream of this.streams.values()) stream.fail(error);
		this.streams.clear();
		this.queue = [];
	}
}
