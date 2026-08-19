export type RedisClient = Pick<
	Bun.RedisClient,
	"get" | "set" | "expire" | "getBuffer" | "del" | "close"
>;

export type RedisClientFactory = (url: string) => RedisClient;

function isTerminalConnectionFailure(cause: unknown): boolean {
	if (!(cause instanceof Error)) return false;
	const code = (cause as Error & { code?: unknown }).code;
	return (
		code === "REDIS_CONNECTION_CLOSED" ||
		code === "ERR_REDIS_CONNECTION_CLOSED" ||
		cause.message.includes("Connection has failed")
	);
}

export class RedisClientPool {
	private readonly clients = new Map<string, RedisClient>();

	constructor(private readonly clientFactory: RedisClientFactory) {}

	async execute<T>(url: string, operation: (client: RedisClient) => Promise<T>): Promise<T> {
		const active = this.getOrCreate(url);
		try {
			return await operation(active);
		} catch (cause) {
			if (!isTerminalConnectionFailure(cause)) throw cause;
			return operation(this.replaceTerminal(url, active));
		}
	}

	close(): void {
		for (const client of this.clients.values()) this.closeClient(client);
		this.clients.clear();
	}

	private getOrCreate(url: string): RedisClient {
		const existing = this.clients.get(url);
		if (existing) return existing;
		const created = this.clientFactory(url);
		this.clients.set(url, created);
		return created;
	}

	private replaceTerminal(url: string, stale: RedisClient): RedisClient {
		if (this.clients.get(url) === stale) {
			this.clients.delete(url);
			this.closeClient(stale);
		}
		return this.getOrCreate(url);
	}

	private closeClient(client: RedisClient): void {
		try {
			client.close();
		} catch {
			// A client being discarded has already failed; cleanup must not block replacement.
		}
	}
}
