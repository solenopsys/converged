import type { CacheAdapter } from "./createServer";
import { getCurrentStorageScope } from "../request-context";
import {
	resolveStorageConnectionTargetForScope,
	type StorageConnectionTarget,
} from "../stores/create";

export interface RuntimeCacheConfig {
	url?: string;
	keyPrefix?: string;
	defaultTtlSeconds?: number;
	port?: number;
	database?: number;
}

const DEFAULT_VALKEY_PORT = 6379;

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

function normalizePositiveInt(value: unknown, fallback: number): number {
	const parsed =
		typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
	return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeNonNegativeInt(value: unknown, fallback: number): number {
	const parsed =
		typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
	return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function cachePort(config: RuntimeCacheConfig): number {
	return normalizePositiveInt(
		process.env.STORAGE_VALKEY_PORT ?? process.env.VALKEY_PORT ?? config.port,
		DEFAULT_VALKEY_PORT,
	);
}

function cacheDatabase(config: RuntimeCacheConfig): number {
	return normalizeNonNegativeInt(
		process.env.STORAGE_VALKEY_DATABASE ??
			process.env.STORAGE_VALKEY_DB ??
			process.env.VALKEY_DATABASE ??
			config.database,
		0,
	);
}

function storageTargetHost(target: StorageConnectionTarget): string {
	if (typeof target === "string") {
		const host = process.env.STORAGE_VALKEY_HOST?.trim();
		if (host) return host;
		throw new Error(
			"Scoped Valkey cache over unix storage requires STORAGE_VALKEY_HOST",
		);
	}
	if (target.kind === "unix") {
		const host = process.env.STORAGE_VALKEY_HOST?.trim();
		if (host) return host;
		throw new Error(
			"Scoped Valkey cache over unix storage requires STORAGE_VALKEY_HOST",
		);
	}
	return target.host;
}

function storageCacheUrl(config: RuntimeCacheConfig): string {
	if (config.url?.trim()) return config.url.trim();
	const scope = getCurrentStorageScope();
	const target = resolveStorageConnectionTargetForScope(scope);
	return `redis://${storageTargetHost(target)}:${cachePort(config)}/${cacheDatabase(config)}`;
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
	const keyPrefix = config.keyPrefix?.trim() || "cache";
	const defaultTtlSeconds =
		Number.isFinite(config.defaultTtlSeconds) &&
		(config.defaultTtlSeconds ?? 0) > 0
			? Math.floor(config.defaultTtlSeconds!)
			: 120;
	const label = config.url?.trim() || "storage-scope";

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
