import type {
	WebSocketChannelController,
	WebSocketClientConfig,
	WebSocketRequestMessage,
	WebSocketResponseMessage,
} from "nrpc";

const DEFAULT_TARGET = "services";
const DEFAULT_DEADLINE_MS = 20_000;
let sessionJwt: string | undefined;

/** The gateway refused us, as opposed to being unreachable or slow. */
export class CliAuthError extends Error {
	readonly code: string;
	/** True when dropping the stored session and retrying can still work. */
	readonly recoverable: boolean;

	constructor(code: string, recoverable: boolean) {
		super(
			code === "no-token"
				? "Fujin requires a user JWT from the CLI session"
				: `Fujin rejected the CLI session: ${code}`,
		);
		this.name = "CliAuthError";
		this.code = code;
		this.recoverable = recoverable;
	}
}

type PendingRequest = {
	resolve: (message: WebSocketResponseMessage) => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
};


export class CliWebSocketChannel implements WebSocketChannelController {
	private socket: WebSocket | null = null;
	private connectPromise: Promise<void> | null = null;
	private pending = new Map<string, PendingRequest>();
	private streams = new Map<string, ResponseStream>();

	async connect(): Promise<void> {
		if (this.socket?.readyState === WebSocket.OPEN) return;
		if (this.connectPromise) return this.connectPromise;

		this.connectPromise = new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(resolveFujinWsUrl(), {
				headers: resolveHeaders(),
			} as never);
			this.socket = socket;
			const timeout = setTimeout(() => {
				if (this.socket !== socket) return;
				socket.close();
				reject(new Error("Timed out connecting to Fujin WebSocket"));
			}, DEFAULT_DEADLINE_MS);

			const complete = () => {
				clearTimeout(timeout);
				resolve();
			};
			socket.onopen = () => {};
			socket.onmessage = (event) => {
				const control = parseControlFrame(event.data);
				if (control?.type === "ready") {
					if (control.authRequired === true) {
						const token = resolveBearerToken();
						if (!token) {
							reject(new CliAuthError("no-token", false));
							socket.close();
							return;
						}
						socket.send(JSON.stringify({ type: "auth", token }));
					} else complete();
					return;
				}
				if (control?.type === "authenticated") {
					complete();
					return;
				}
				if (control?.type === "auth_error") {
					// Recoverable as long as a stored session JWT is what we sent: it
					// can be dropped and the connection retried with the service token,
					// which is the only way `auth login` can run when it has expired.
					reject(
						new CliAuthError(
							control.code ?? "unauthenticated",
							sessionJwt !== undefined,
						),
					);
					socket.close();
					return;
				}
				this.onMessage(event.data);
			};
			socket.onerror = () => {
				clearTimeout(timeout);
				reject(new Error("Failed to connect to Fujin WebSocket"));
			};
			socket.onclose = () => {
				clearTimeout(timeout);
				if (this.socket !== socket) return;
				this.socket = null;
				this.connectPromise = null;
				this.rejectAll(new Error("Fujin WebSocket connection was interrupted"));
			};
		}).finally(() => {
			this.connectPromise = null;
		});
		return this.connectPromise;
	}

	async request(
		message: WebSocketRequestMessage,
	): Promise<WebSocketResponseMessage> {
		return new Promise<WebSocketResponseMessage>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(message.requestId);
				reject(new Error(`NRPC request timed out: ${message.method}`));
			}, message.deadlineMs);
			this.pending.set(message.requestId, { resolve, reject, timer });
			this.send(message, reject);
		});
	}

	requestStream(
		message: WebSocketRequestMessage,
	): AsyncIterable<WebSocketResponseMessage> {
		const stream = new ResponseStream(() =>
			this.streams.delete(message.requestId),
		);
		this.streams.set(message.requestId, stream);
		this.send(message, (error) => stream.fail(error));
		return stream;
	}

	close(): void {
		this.socket?.close();
		this.socket = null;
		this.connectPromise = null;
		this.rejectAll(new Error("CLI WebSocket channel stopped"));
	}

	private send(
		message: WebSocketRequestMessage,
		fail: (error: Error) => void,
	): void {
		void this.connect()
			.then(() => {
				if (this.socket?.readyState !== WebSocket.OPEN) {
					throw new Error("Fujin WebSocket is not open");
				}
				this.socket.send(JSON.stringify(message));
			})
			.catch((error: unknown) =>
				fail(error instanceof Error ? error : new Error(String(error))),
			);
	}

	private onMessage(data: unknown): void {
		if (typeof data !== "string") return;
		let message: WebSocketResponseMessage;
		try {
			message = JSON.parse(data) as WebSocketResponseMessage;
		} catch {
			return;
		}
		if (!message.requestId) return;
		const stream = this.streams.get(message.requestId);
		if (stream) {
			stream.push(message);
			if (message.kind === "error" || message.fin)
				this.streams.delete(message.requestId);
			return;
		}
		const pending = this.pending.get(message.requestId);
		if (!pending) return;
		clearTimeout(pending.timer);
		this.pending.delete(message.requestId);
		pending.resolve(message);
	}

	private rejectAll(error: Error): void {
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(error);
		}
		this.pending.clear();
		for (const stream of this.streams.values()) stream.fail(error);
		this.streams.clear();
	}
}

class ResponseStream implements AsyncIterable<WebSocketResponseMessage> {
	private values: WebSocketResponseMessage[] = [];
	private waiter:
		| ((result: IteratorResult<WebSocketResponseMessage>) => void)
		| null = null;
	private error: Error | null = null;
	private done = false;

	constructor(private readonly onClose: () => void) {}

	push(message: WebSocketResponseMessage): void {
		if (this.done) return;
		if (this.waiter) {
			const resolve = this.waiter;
			this.waiter = null;
			resolve({ value: message, done: false });
		} else this.values.push(message);
		if (message.kind === "error" || message.fin) this.finish();
	}

	fail(error: Error): void {
		if (this.done) return;
		this.error = error;
		this.finish();
	}

	private finish(): void {
		this.done = true;
		this.onClose();
		if (this.waiter) {
			const resolve = this.waiter;
			this.waiter = null;
			resolve({ value: undefined, done: true });
		}
	}

	async *[Symbol.asyncIterator](): AsyncIterator<WebSocketResponseMessage> {
		while (true) {
			if (this.values.length) {
				const value = this.values.shift();
				if (value !== undefined) yield value;
			} else if (this.error) throw this.error;
			else if (this.done) return;
			else {
				const value = await new Promise<WebSocketResponseMessage | undefined>(
					(resolve) => {
						this.waiter = (result) =>
							resolve(result.done ? undefined : result.value);
					},
				);
				if (value !== undefined) yield value;
				else if (this.error) throw this.error;
				else return;
			}
		}
	}
}

function resolveFujinWsUrl(): string {
	const url = process.env.FUJIN_WS_URL?.trim();
	if (!url) throw new Error("Missing required FUJIN_WS_URL environment variable");
	return url;
}

function resolveHeaders(): Record<string, string> {
	const headers: Record<string, string> = {};
	const token = resolveBearerToken();
	if (token) headers.authorization = `Bearer ${token}`;
	const scope =
		process.env.STORAGE_SCOPE?.trim() || process.env.WORKSPACE?.trim();
	if (scope) headers["x-storage-scope"] = scope;
	return headers;
}

function resolveBearerToken(): string | undefined {
	return sessionJwt ?? (process.env.SERVICE_TOKEN?.trim() || undefined);
}

function parseControlFrame(data: unknown): { type?: string; authRequired?: boolean; code?: string } | null {
	if (typeof data !== "string") return null;
	try {
		const value = JSON.parse(data);
		return typeof value === "object" && value !== null ? value : null;
	} catch {
		return null;
	}
}

/** JWT resolved from the local CLI login session. Takes precedence over a
 * process service token because Fujin admin methods are user-only. */
export function setCliSessionJwt(token: string | undefined): void {
	sessionJwt = token?.trim() || undefined;
}

export const cliWebSocketChannel = new CliWebSocketChannel();

export function createCliNrpcClientConfig(
	options: { target?: string; deadlineMs?: number } = {},
): WebSocketClientConfig {
	const target = (
		options.target ??
		process.env.FUJIN_BACKEND_TARGET ??
		DEFAULT_TARGET
	).trim();
	if (!target) throw new Error("Fujin CLI target is empty");
	const deadlineMs =
		options.deadlineMs ??
		Number(process.env.FUJIN_NRPC_DEADLINE_MS ?? DEFAULT_DEADLINE_MS);
	if (!Number.isSafeInteger(deadlineMs) || deadlineMs <= 0) {
		throw new Error("Fujin CLI deadline must be a positive integer");
	}
	return { channel: cliWebSocketChannel, target, deadlineMs };
}
