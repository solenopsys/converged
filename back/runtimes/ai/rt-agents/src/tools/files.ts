import { createFilesServiceClient } from "g-files";
import { type CacheRef, createStoreServiceClient } from "g-store";

function filesClient() {
	return createFilesServiceClient({ baseUrl: process.env.SERVICES_BASE });
}

function storeClient() {
	return createStoreServiceClient({ baseUrl: process.env.SERVICES_BASE });
}

/** `<root>/services` → `<root>/cache/blob`. Binary chunk bodies are transferred
 * through the Valkey cache; the store RPC only carries CacheRefs. */
function cacheBlobBaseUrl(): string {
	const baseUrl = process.env.SERVICES_BASE;
	if (!baseUrl) throw new Error("SERVICES_BASE is required to download files");
	const normalized = baseUrl.replace(/\/+$/, "");
	const root = normalized.endsWith("/services")
		? normalized.slice(0, -"/services".length)
		: normalized;
	return `${root}/cache/blob`;
}

/** A backend fetch carries no tenant Host, so propagate the storage scope as the
 * `scope` header — the same one the nrpc client sends — or `/cache/blob` 500s. */
function scopeHeaders(): Record<string, string> {
	const scope =
		typeof globalThis !== "undefined"
			? (globalThis as any).__NRPC_SCOPE_RESOLVER__?.()
			: undefined;
	return scope ? { scope: String(scope) } : {};
}

async function getCacheBlob(ref: CacheRef): Promise<Uint8Array> {
	if (!ref?.cacheKey) throw new Error("Cache reference is missing cacheKey");
	const response = await fetch(
		`${cacheBlobBaseUrl()}/${encodeURIComponent(ref.cacheKey)}`,
		{ headers: scopeHeaders() },
	);
	if (!response.ok) {
		throw new Error(`Cache blob download failed: ${response.status}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

function normalizeCacheRef(value: unknown): CacheRef {
	const ref =
		value && typeof value === "object" && "result" in value
			? (value as any).result
			: value;
	if (
		ref &&
		typeof ref === "object" &&
		typeof (ref as any).cacheKey === "string"
	) {
		return {
			cacheKey: (ref as any).cacheKey,
			sizeBytes:
				typeof (ref as any).sizeBytes === "number"
					? (ref as any).sizeBytes
					: undefined,
		};
	}
	throw new Error("Store returned invalid cache reference");
}

export async function downloadFileBytes(fileId: string): Promise<Uint8Array> {
	const chunks = await filesClient().getChunks(fileId);
	if (chunks.length === 0)
		throw new Error(`No chunks found for file ${fileId}`);

	const sorted = [...chunks].sort((a, b) => a.chunkNumber - b.chunkNumber);
	const refs = await Promise.all(sorted.map((c) => storeClient().get(c.hash)));
	const parts = await Promise.all(
		refs.map((ref) => getCacheBlob(normalizeCacheRef(ref))),
	);

	const total = parts.reduce((n, p) => n + p.byteLength, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		result.set(part, offset);
		offset += part.byteLength;
	}
	return result;
}
