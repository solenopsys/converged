import type { CacheAdapter } from "./createServer";

export interface RuntimeCacheConfig {
	url: string;
	keyPrefix?: string;
	defaultTtlSeconds?: number;
}

function normalizeSegment(segment: string | number): string {
	return encodeURIComponent(String(segment));
}

function toBytes(value: unknown): Uint8Array | null {
	if (value == null) return null;
	if (value instanceof Uint8Array) return new Uint8Array(value);
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	if (typeof value === "string") return new TextEncoder().encode(value);
	return new Uint8Array(value as ArrayBufferLike);
}

export function createBunRedisCache(config: RuntimeCacheConfig): CacheAdapter {
	const client = new Bun.RedisClient(config.url, {
		connectionTimeout: 5000,
		autoReconnect: true,
		enableAutoPipelining: true,
	});
	const keyPrefix = config.keyPrefix?.trim() || "cache";
	const defaultTtlSeconds =
		Number.isFinite(config.defaultTtlSeconds) &&
		(config.defaultTtlSeconds ?? 0) > 0
			? Math.floor(config.defaultTtlSeconds!)
			: 120;

	const buildKey = (...segments: Array<string | number>) =>
		[keyPrefix, ...segments.map(normalizeSegment)].join(":");

	const get = async (key: string): Promise<string | null> => {
		const value = await client.get(key);
		return typeof value === "string"
			? value
			: value == null
				? null
				: String(value);
	};

	const set = async (
		key: string,
		value: string,
		ttlSeconds = defaultTtlSeconds,
	): Promise<void> => {
		await client.set(key, value);
		if (ttlSeconds > 0) {
			await client.expire(key, ttlSeconds);
		}
	};

	const getBytes = async (key: string): Promise<Uint8Array | null> => {
		const value = await client.getBuffer(key);
		return toBytes(value);
	};

	const setBytes = async (
		key: string,
		value: Uint8Array,
		ttlSeconds = defaultTtlSeconds,
	): Promise<void> => {
		await (
			client.set as unknown as (
				key: string,
				value: Uint8Array,
			) => Promise<unknown>
		)(key, value);
		if (ttlSeconds > 0) {
			await client.expire(key, ttlSeconds);
		}
	};

	const del = async (key: string): Promise<void> => {
		await client.del(key);
	};

	const getJson = async <T>(key: string): Promise<T | null> => {
		const raw = await get(key);
		if (!raw) return null;
		return JSON.parse(raw) as T;
	};

	const setJson = async (
		key: string,
		value: unknown,
		ttlSeconds = defaultTtlSeconds,
	): Promise<void> => {
		await set(key, JSON.stringify(value), ttlSeconds);
	};

	return {
		url: config.url,
		keyPrefix,
		defaultTtlSeconds,
		buildKey,
		get,
		set,
		getBytes,
		setBytes,
		del,
		getJson,
		setJson,
		close: () => {
			client.close();
		},
	};
}
