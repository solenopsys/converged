import {
	MessageKind,
	type IncomingMessage,
	type MessageEnvelope,
	MessagingConnection,
	type MessagingConnectionOptions,
	PayloadCodec,
} from "bun-transport/messaging";
import type { ServiceMetadata } from "../types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface MessagingMethodDescriptor {
	name: string;
	access: "public" | "user" | "internal";
}

export interface MessagingServiceDescriptor {
	name: string;
	methods: MessagingMethodDescriptor[];
}

export interface MessagingDispatchResult {
	payload?: Uint8Array;
	stream?: AsyncIterable<Uint8Array>;
}

export interface MessagingServiceHandler {
	descriptor: MessagingServiceDescriptor;
	waitUntilReady(): Promise<void>;
	shutdown(): Promise<void>;
	dispatch(message: IncomingMessage): Promise<MessagingDispatchResult>;
}

export interface MessagingRuntimeConfig {
	connection: MessagingChannel | MessagingConnectionOptions;
	target: string;
	pollIntervalMs: number;
	maxMessagesPerPoll: number;
}

export interface MessagingChannel {
	declareTarget(target: string): void;
	send(envelope: MessageEnvelope, payload?: Uint8Array): void;
	recvNowait(): IncomingMessage | null;
	close(): void;
}

export interface MessagingRequest {
	target: string;
	service: string;
	method: string;
	scope?: string;
	user?: string;
	auth?: string;
	deadlineMs: number;
	payload: Uint8Array;
}

type PendingRegular = {
	kind: "regular";
	resolve(value: Uint8Array): void;
	reject(error: Error): void;
	timer: ReturnType<typeof setTimeout>;
};

type PendingStream = {
	kind: "stream";
	queue: AsyncMessageQueue;
	deadlineMs: number;
	timer: ReturnType<typeof setTimeout>;
};

type Pending = PendingRegular | PendingStream;

/**
 * Targets already live in this process. Fujin maps a name to exactly one ZMQ
 * identity (last registration wins), so two runtimes sharing a target silently
 * steal each other's replies: the loser's requests only ever hit their
 * deadline, with no error on either side. One runtime per target, per process.
 */
const startedTargets = new Set<string>();

export class NrpcMessagingRuntime {
	readonly connection: MessagingChannel;
	private readonly handlers = new Map<string, MessagingServiceHandler>();
	private readonly pending = new Map<string, Pending>();
	private timer?: ReturnType<typeof setInterval>;
	/// In flight start(), so a call that arrives during startup waits for it
	/// rather than failing: the server accepts requests before every plugin has
	/// finished registering, and that window is normal, not an error.
	private starting?: Promise<void>;
	/// Ids we stopped waiting for, kept only so a reply that shows up afterwards
	/// can be named as late instead of "unknown". Bounded — this is a diagnostic
	/// breadcrumb, not a record.
	private readonly expired = new Set<string>();
	private started = false;
	private polling = false;

	constructor(readonly config: MessagingRuntimeConfig) {
		if (!config.target.trim()) throw new Error("nrpc messaging target is empty");
		assertPositiveInteger("pollIntervalMs", config.pollIntervalMs);
		assertPositiveInteger("maxMessagesPerPoll", config.maxMessagesPerPoll);
		if (isMessagingChannel(config.connection)) {
			this.connection = config.connection;
		} else {
			this.connection = new MessagingConnection(config.connection);
		}
	}

	// A separate, dynamic operation on purpose — a handler can be registered
	// any time, including well after start() (e.g. a plugin that finishes
	// async init later, or a store created at runtime). Fires the wire-level
	// registration immediately when the runtime is already started; if not,
	// start() registers everything queued so far.
	registerService(handler: MessagingServiceHandler): void {
		if (this.handlers.has(handler.descriptor.name)) {
			throw new Error(`nrpc service already registered: ${handler.descriptor.name}`);
		}
		this.handlers.set(handler.descriptor.name, handler);
	}

	unregisterService(name: string): void {
		this.handlers.delete(name);
	}

	start(): Promise<void> {
		if (this.started) return Promise.resolve();
		if (this.starting) return this.starting;
		// A failed start must not be remembered: the target may free up (its
		// owner shuts down) and the next attempt has to run for real.
		this.starting = this.startOnce().catch((error) => {
			this.starting = undefined;
			throw error;
		});
		return this.starting;
	}

	private async startOnce(): Promise<void> {
		if (startedTargets.has(this.config.target)) {
			throw new Error(
				`nrpc messaging target already registered in this process: ${this.config.target} — ` +
					"reuse the existing runtime instead of opening a second connection",
			);
		}
		for (const handler of this.handlers.values()) await handler.waitUntilReady();
		this.started = true;
		startedTargets.add(this.config.target);
		this.declareTarget();
		// `[nrpc]`, not `[fujin]`: this is the in-process messaging client
		// announcing itself. The router's own log lines carry the fujin prefix,
		// and mixing the two makes a peer look like the daemon.
		console.log(
			`[nrpc] registered target=${this.config.target} services=${[...this.handlers.keys()].join(",")}`,
		);
		this.timer = setInterval(() => this.poll(), this.config.pollIntervalMs);
	}

	private rememberExpired(requestId: string): void {
		if (this.expired.size >= 256) this.expired.delete(this.expired.values().next().value as string);
		this.expired.add(requestId);
	}

	/// Zig owns target registration and maintains it across router restarts.
	private declareTarget(): void {
		this.connection.declareTarget(this.config.target);
	}

	async close(): Promise<void> {
		if (this.timer) clearInterval(this.timer);
		this.timer = undefined;
		if (this.started) startedTargets.delete(this.config.target);
		this.started = false;
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timer);
			const error = new Error("nrpc messaging runtime closed");
			if (pending.kind === "regular") pending.reject(error);
			else pending.queue.fail(error);
		}
		this.pending.clear();
		for (const handler of this.handlers.values()) await handler.shutdown();
		this.connection.close();
	}

	async request(request: MessagingRequest): Promise<Uint8Array> {
		await this.whenStarted();
		assertRequest(request);
		const requestId = crypto.randomUUID();
		return new Promise<Uint8Array>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(requestId);
				this.rememberExpired(requestId);
				reject(
					new Error(
						`nrpc request timed out after ${request.deadlineMs}ms: ` +
							`${request.target}/${request.service}.${request.method} id=${requestId.slice(0, 8)}`,
					),
				);
			}, request.deadlineMs);
			this.pending.set(requestId, { kind: "regular", resolve, reject, timer });
			try {
				this.sendRequest(request, requestId);
			} catch (error) {
				clearTimeout(timer);
				this.pending.delete(requestId);
				reject(normalizeError(error));
			}
		});
	}

	requestStream(request: MessagingRequest): AsyncIterable<Uint8Array> {
		this.assertStarted();
		assertRequest(request);
		const requestId = crypto.randomUUID();
		const queue = new AsyncMessageQueue(() => {
			const pending = this.pending.get(requestId);
			if (pending) clearTimeout(pending.timer);
			this.pending.delete(requestId);
			this.connection.send({
				kind: MessageKind.event,
				requestId,
				to: { target: request.target, service: request.service },
				method: "cancel",
				from: { target: this.config.target },
				codec: PayloadCodec.json,
			}, encoder.encode(JSON.stringify({ requestId })));
		});
		const timer = setTimeout(() => {
			this.pending.delete(requestId);
			this.rememberExpired(requestId);
			queue.fail(
				new Error(
					`nrpc stream idle timeout after ${request.deadlineMs}ms: ` +
						`${request.target}/${request.service}.${request.method} id=${requestId.slice(0, 8)}`,
				),
			);
		}, request.deadlineMs);
		this.pending.set(requestId, { kind: "stream", queue, deadlineMs: request.deadlineMs, timer });
		try {
			this.sendRequest(request, requestId);
		} catch (error) {
			clearTimeout(timer);
			this.pending.delete(requestId);
			queue.fail(normalizeError(error));
		}
		return queue;
	}

	poll(): void {
		if (!this.started || this.polling) return;
		this.polling = true;
		try {
			for (let index = 0; index < this.config.maxMessagesPerPoll; index++) {
				const message = this.connection.recvNowait();
				if (!message) break;
				this.handleIncoming(message);
			}
		} finally {
			this.polling = false;
		}
	}

	private sendRequest(request: MessagingRequest, requestId: string): void {
		this.connection.send({
			kind: MessageKind.request,
			requestId,
			to: { target: request.target, service: request.service },
			from: { target: this.config.target },
			method: request.method,
			scope: request.scope,
			user: request.user,
			auth: request.auth,
			codec: PayloadCodec.json,
			deadlineMs: request.deadlineMs,
		}, request.payload);
	}

	private handleIncoming(message: IncomingMessage): void {
		switch (message.envelope.kind) {
			case MessageKind.response:
			case MessageKind.error:
			case MessageKind.streamChunk:
				this.handleReply(message);
				return;
			case MessageKind.request:
				void this.dispatchRequest(message);
				return;
		}
	}

	private handleReply(message: IncomingMessage): void {
		const requestId = message.envelope.requestId;
		const pending = this.pending.get(requestId);
		if (!pending) {
			// Distinguish the two causes instead of printing one ambiguous line:
			// a late reply means we already gave up on this id, anything else
			// means the reply landed on the wrong socket for this target.
			const late = this.expired.has(requestId);
			const code = message.envelope.errorCode;
			console.warn(
				`[nrpc] ${late ? "late reply (caller already timed out)" : "reply for unknown request"} ` +
					`target=${this.config.target} method=${message.envelope.method || "?"} ` +
					`id=${requestId.slice(0, 8)}${code ? ` error=${code}` : ""}`,
			);
			if (late) this.expired.delete(requestId);
			return;
		}

		if (message.envelope.kind === MessageKind.error) {
			clearTimeout(pending.timer);
			this.pending.delete(requestId);
			const error = decodeRemoteError(message);
			if (pending.kind === "regular") pending.reject(error);
			else pending.queue.fail(error);
			return;
		}

		if (pending.kind === "regular") {
			clearTimeout(pending.timer);
			this.pending.delete(requestId);
			pending.resolve(message.payload);
			return;
		}

		clearTimeout(pending.timer);
		if (message.payload.byteLength > 0) pending.queue.push(message.payload);
		if (message.envelope.fin) {
			this.pending.delete(requestId);
			pending.queue.finish();
		} else {
			pending.timer = setTimeout(() => {
				this.pending.delete(requestId);
				pending.queue.fail(new Error("nrpc stream idle timeout"));
			}, pending.deadlineMs);
		}
	}

	private async dispatchRequest(message: IncomingMessage): Promise<void> {
		const handler = this.handlers.get(message.envelope.to.service);
		if (!handler) {
			this.sendDispatchError(message, "service_unavailable", `service not registered: ${message.envelope.to.service}`);
			return;
		}
		try {
			const result = await handler.dispatch(message);
			if (result.stream) {
				let seq = 1;
				for await (const payload of result.stream) {
					this.connection.send(this.replyEnvelope(message, MessageKind.streamChunk, { seq, fin: false }), payload);
					seq++;
				}
				this.connection.send(this.replyEnvelope(message, MessageKind.streamChunk, { seq, fin: true }), new Uint8Array());
				return;
			}
			this.connection.send(this.replyEnvelope(message, MessageKind.response), result.payload ?? new Uint8Array());
		} catch (error) {
			const normalized = normalizeError(error) as Error & { code?: string; details?: unknown; statusCode?: number };
			logDispatchError(message.envelope.to.service, message.envelope.method, normalized);
			this.sendDispatchError(message, normalized.code ?? "application_error", normalized.message, normalized.details);
		}
	}

	private replyEnvelope(
		request: IncomingMessage,
		kind: typeof MessageKind.response | typeof MessageKind.error | typeof MessageKind.streamChunk,
		stream: { seq: number; fin: boolean } = { seq: 0, fin: false },
	): MessageEnvelope {
		return {
			kind,
			requestId: request.envelope.requestId,
			to: request.envelope.from,
			from: { target: this.config.target, service: request.envelope.to.service },
			method: request.envelope.method,
			scope: request.envelope.scope,
			user: request.envelope.user,
			codec: PayloadCodec.json,
			seq: stream.seq,
			fin: stream.fin,
		};
	}

	private sendDispatchError(request: IncomingMessage, code: string, message: string, details?: unknown): void {
		this.connection.send({ ...this.replyEnvelope(request, MessageKind.error), errorCode: code }, encoder.encode(JSON.stringify({ error: message, code, details })));
	}

	private assertStarted(): void {
		if (!this.started) throw new Error("nrpc messaging runtime is not started");
	}

	private async whenStarted(): Promise<void> {
		if (this.started) return;
		if (this.starting) await this.starting;
		this.assertStarted();
	}
}

export function serviceDescriptor(metadata: ServiceMetadata): MessagingServiceDescriptor {
	return { name: metadata.serviceName, methods: metadata.methods.map((method) => ({ name: method.name, access: "user" })) };
}

class AsyncMessageQueue implements AsyncIterable<Uint8Array> {
	private values: Uint8Array[] = [];
	private waiters: Array<{ resolve(value: IteratorResult<Uint8Array>): void; reject(error: Error): void }> = [];
	private done = false;
	private error?: Error;

	constructor(private readonly onCancel: () => void) {}

	push(value: Uint8Array): void {
		const waiter = this.waiters.shift();
		if (waiter) waiter.resolve({ value, done: false });
		else this.values.push(value);
	}

	finish(): void {
		this.done = true;
		for (const waiter of this.waiters.splice(0)) waiter.resolve({ value: undefined, done: true });
	}

	fail(error: Error): void {
		this.error = error;
		this.done = true;
		for (const waiter of this.waiters.splice(0)) waiter.reject(error);
	}

	[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
		return {
			next: () => {
				const value = this.values.shift();
				if (value) return Promise.resolve({ value, done: false });
				if (this.error) return Promise.reject(this.error);
				if (this.done) return Promise.resolve({ value: undefined, done: true });
				return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
			},
			return: async () => {
				if (!this.done) this.onCancel();
				this.finish();
				return { value: undefined, done: true };
			},
		};
	}
}

function assertRequest(request: MessagingRequest): void {
	if (!request.target.trim()) throw new Error("nrpc request target is empty");
	if (!request.service.trim()) throw new Error("nrpc request service is empty");
	if (!request.method.trim()) throw new Error("nrpc request method is empty");
	assertPositiveInteger("deadlineMs", request.deadlineMs);
}

function assertPositiveInteger(name: string, value: number): void {
	if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

function normalizeError(error: unknown): Error {
	return error instanceof Error ? error : new Error(typeof error === "string" ? error : "unknown nrpc error");
}

function logDispatchError(serviceName: string, methodName: string, error: Error & { code?: string; details?: unknown; statusCode?: number }): void {
	const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;
	const code = error.code ?? "application_error";
	const message = error.message || code;
	const details = error.details === undefined ? "" : ` details=${JSON.stringify(error.details)}`;
	const line = `[nrpc:call] ${serviceName}.${methodName} status=${statusCode} code=${code} message="${message}"${details}`;
	if (statusCode >= 400 && statusCode < 500) {
		console.warn(line);
		return;
	}
	console.error(line);
	if ((isVerboseErrorsEnabled() || process.env.NODE_ENV !== "production") && error.stack) console.error(error.stack);
}

function isVerboseErrorsEnabled(): boolean {
	const value = (process.env.NRPC_VERBOSE_ERRORS ?? "").toLowerCase();
	return value === "1" || value === "true" || value === "yes";
}

function decodeRemoteError(message: IncomingMessage): Error {
	try {
		const body = JSON.parse(decoder.decode(message.payload));
		const error = new Error(body.error || message.envelope.errorCode || "remote nrpc error") as Error & { code?: string; details?: unknown; statusCode?: number };
		error.code = body.code || message.envelope.errorCode;
		error.details = body.details;
		if (error.code === "unauthenticated") error.statusCode = 401;
		else if (error.code === "forbidden" || error.code === "internal_only") error.statusCode = 403;
		return error;
	} catch {
		return new Error(message.envelope.errorCode || "remote nrpc error");
	}
}

function isMessagingChannel(value: MessagingChannel | MessagingConnectionOptions): value is MessagingChannel {
	return typeof (value as MessagingChannel).send === "function" &&
		typeof (value as MessagingChannel).recvNowait === "function";
}
