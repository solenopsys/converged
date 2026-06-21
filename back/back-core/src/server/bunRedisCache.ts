import type { CacheAdapter } from "./createServer";
import { settings } from "../config/settings";
import { getCurrentStorageScope } from "../request-context";
import {
	resolveStorageConnectionTargetForScope,
	type StorageConnectionTarget,
} from "../stores/connection-target";

export interface RuntimeCacheConfig {
	url?: string;
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

function storageTargetHost(target: StorageConnectionTarget): string {
	// Valkey is co-located with the storage node for the current scope: same
	// host as the resolved tcp storage target. No fallback host — if the target
	// is not tcp, the storage env is misconfigured and we fail loudly.
	if (typeof target === "string" || target.kind !== "tcp") {
		throw new Error(
			`Valkey cache requires a tcp storage target, got: ${JSON.stringify(target)}`,
		);
	}
	return target.host;
}

function storageCacheUrl(config: RuntimeCacheConfig): string {
	if (config.url?.trim()) return config.url.trim();
	const scope = getCurrentStorageScope();
	const target = resolveStorageConnectionTargetForScope(scope);
	const host = storageTargetHost(target);
	return `redis://${host}:${settings.cache.valkeyPort()}`;
}

function createRedisClient(url: string): Bun.RedisClient {
	return new Bun.RedisClient(url, {
		connectionTimeout: 5000,
		autoReconnect: true,
		enableAutoPipelining: true,
	});
}

export function createBunRedisCache(config: RuntimeCacheConfig): CacheAdapter {
	const clients = new Map<string, Bun.RedisClient>();
	const keyPrefix = config.keyPrefix?.trim();
	if (!keyPrefix) {
		throw new Error("Cache keyPrefix is required (runtime-map [cache].keyPrefix)");
	}
	const ttl = config.defaultTtlSeconds;
	if (typeof ttl !== "number" || !Number.isFinite(ttl) || ttl <= 0) {
		throw new Error(
			"Cache defaultTtlSeconds is required and must be a positive integer (runtime-map [cache].ssrTtlSeconds)",
		);
	}
	const defaultTtlSeconds = Math.floor(ttl);
	const label = config.url?.trim() ?? "storage-scope";

	const client = (): Bun.RedisClient => {
		const url = storageCacheUrl(config);
		const existing = clients.get(url);
		if (existing) return existing;
		const created = createRedisClient(url);
		clients.set(url, created);
		return created;
	};

	const buildKey = (...segments: Array<string | number>) =>
		[keyPrefix, ...segments.map(normalizeSegment)].join(":");

	const get = async (key: string): Promise<string | null> => {
		const value = await client().get(key);
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
		const redis = client();
		await redis.set(key, value);
		if (ttlSeconds > 0) {
			await redis.expire(key, ttlSeconds);
		}
	};

	const getBytes = async (key: string): Promise<Uint8Array | null> => {
		const value = await client().getBuffer(key);
		return toBytes(value);
	};

	const setBytes = async (
		key: string,
		value: Uint8Array,
		ttlSeconds = defaultTtlSeconds,
	): Promise<void> => {
		const redis = client();
		await (
			redis.set as unknown as (
				key: string,
				value: Uint8Array,
			) => Promise<unknown>
		)(key, value);
		if (ttlSeconds > 0) {
			await redis.expire(key, ttlSeconds);
		}
	};

	const del = async (key: string): Promise<void> => {
		await client().del(key);
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
		url: label,
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
			for (const client of clients.values()) {
				client.close();
			}
			clients.clear();
		},
	};
}
