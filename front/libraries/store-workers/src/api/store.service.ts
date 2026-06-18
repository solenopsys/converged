import { REQUEST_TIMEOUT } from "../../../files-state/src/config";
import {
	createStoreServiceClient,
	type StoreServiceClient,
	type CacheRef,
	type HashString,
} from "g-store";
import type { CompressionType } from "../types";

export interface CreateStoreServiceOptions {
	baseUrl?: string;
	headers?: Record<string, string>;
	requestTimeoutMs?: number;
	owner?: string;
}

export interface StoreService {
	save(
		data: Uint8Array,
		originalSize?: number,
		compression?: CompressionType,
	): Promise<HashString>;
	get(hash: HashString): Promise<Uint8Array>;
	delete(hash: HashString): Promise<void>;
}

const DEFAULT_BASE_URL = "/services";

function normalizeBaseUrl(baseUrl: string): string {
	const normalized = baseUrl.replace(/\/+$/, "");
	return normalized.endsWith("/store")
		? normalized.slice(0, -"/store".length)
		: normalized;
}

function resolveCacheBlobBaseUrl(baseUrl: string): string {
	const servicesBase = normalizeBaseUrl(baseUrl);
	const root = servicesBase.endsWith("/services")
		? servicesBase.slice(0, -"/services".length)
		: "";
	return `${root}/cache/blob`;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(data.byteLength);
	copy.set(data);
	return copy.buffer;
}

function normalizeHash(result: unknown): HashString {
	if (typeof result === "string") return result as HashString;
	if (
		result &&
		typeof result === "object" &&
		typeof (result as any).result === "string"
	) {
		return (result as any).result as HashString;
	}
	throw new Error(`StoreService.save returned invalid hash: ${String(result)}`);
}

function normalizeCacheRef(result: unknown): CacheRef {
	const value =
		result && typeof result === "object" && "result" in result
			? (result as any).result
			: result;
	if (
		value &&
		typeof value === "object" &&
		typeof (value as any).cacheKey === "string"
	) {
		return {
			cacheKey: (value as any).cacheKey,
			sizeBytes:
				typeof (value as any).sizeBytes === "number"
					? (value as any).sizeBytes
					: undefined,
		};
	}
	throw new Error("StoreService returned invalid cache reference");
}

export function createStoreService(
	options: CreateStoreServiceOptions = {},
): StoreService {
	const {
		baseUrl = DEFAULT_BASE_URL,
		headers = {},
		owner,
		requestTimeoutMs = REQUEST_TIMEOUT,
	} = options;

	const client: StoreServiceClient = createStoreServiceClient({
		baseUrl: normalizeBaseUrl(baseUrl),
		headers,
		timeout: requestTimeoutMs,
	} as any);
	const cacheBlobBaseUrl = resolveCacheBlobBaseUrl(baseUrl);

	async function putCacheBlob(data: Uint8Array): Promise<CacheRef> {
		const response = await fetch(cacheBlobBaseUrl, {
			method: "POST",
			headers: {
				...headers,
				"Content-Type": "application/octet-stream",
			},
			body: toArrayBuffer(data),
		});
		if (!response.ok) {
			throw new Error(`Cache blob upload failed: ${response.status}`);
		}
		return normalizeCacheRef(await response.json());
	}

	async function getCacheBlob(ref: CacheRef): Promise<Uint8Array> {
		const response = await fetch(
			`${cacheBlobBaseUrl}/${encodeURIComponent(ref.cacheKey)}`,
			{
				headers,
			},
		);
		if (!response.ok) {
			throw new Error(`Cache blob download failed: ${response.status}`);
		}
		return new Uint8Array(await response.arrayBuffer());
	}

	async function save(
		data: Uint8Array,
		originalSize?: number,
		compression?: CompressionType,
	): Promise<HashString> {
		const dataRef = await putCacheBlob(data);
		const hash = await client.save(
			dataRef,
			originalSize ?? data.length,
			compression ?? "none",
			owner,
		);
		return normalizeHash(hash);
	}

	async function get(hash: HashString): Promise<Uint8Array> {
		return getCacheBlob(normalizeCacheRef(await client.get(hash)));
	}

	async function deleteBlock(hash: HashString): Promise<void> {
		await client.delete(hash);
	}

	return {
		save,
		get,
		delete: deleteBlock,
	};
}
