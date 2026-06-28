import { createHash } from "node:crypto";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { deflateSync, inflateSync } from "fflate";
import {
	createFilesServiceClient,
	type FileChunk,
	type FileMetadata,
	type FilesServiceClient,
} from "g-files";
import {
	type CacheRef,
	type CompressionType,
	createStoreServiceClient,
	type StoreServiceClient,
} from "g-store";

const DEFAULT_CHUNK_SIZE = 512 * 1024;

export type StorageClients = {
	files: FilesServiceClient;
	store: StoreServiceClient;
	/** Root URL of the gateway's `/cache/blob` endpoint. Binary chunk bodies are
	 * transferred through the Valkey cache (the nrpc RPC only carries CacheRefs),
	 * so reads/writes go through this endpoint, not the store RPC payload. */
	cacheBlobBaseUrl: string;
};

export type StoredFile = {
	metadata: FileMetadata;
	chunks: FileChunk[];
	bytes: Uint8Array;
};

export type SaveStoredFileInput = {
	name: string;
	bytes: Uint8Array;
	fileType?: string;
	owner?: string;
	chunkSize?: number;
	collectionId?: string;
	/** Correlation id of the process saving this file. Forwarded to the
	 * file.created business event as parentId so the dashboard groups all
	 * files produced by one workflow run into a single card. */
	processId?: string;
};

/** Storage scope for service-to-service calls. The browser resolves scope from
 * the request Host, but a backend `fetch` to `/cache/blob` carries no tenant
 * Host — so we must send the scope header explicitly, the same way the nrpc
 * client does (it reads the same global resolver set by server.entry). Without
 * it the gateway can't resolve the tenant and `/cache/blob` fails with 500. */
function cacheBlobHeaders(
	extra?: Record<string, string>,
): Record<string, string> {
	const scope =
		typeof globalThis !== "undefined"
			? (globalThis as any).__NRPC_SCOPE_RESOLVER__?.()
			: undefined;
	return {
		...(extra ?? {}),
		...(scope ? { scope: String(scope) } : {}),
	};
}

/** `<root>/services` → `<root>/cache/blob` (mirrors the front store client). */
function resolveCacheBlobBaseUrl(baseUrl: string): string {
	const normalized = baseUrl.replace(/\/+$/, "");
	const root = normalized.endsWith("/services")
		? normalized.slice(0, -"/services".length)
		: normalized;
	return `${root}/cache/blob`;
}

export function createStorageClients(
	baseUrl = process.env.SERVICES_BASE,
): StorageClients {
	if (!baseUrl) {
		throw new Error("SERVICES_BASE is required for file storage clients");
	}
	return {
		files: createFilesServiceClient({ baseUrl }),
		store: createStoreServiceClient({ baseUrl }),
		cacheBlobBaseUrl: resolveCacheBlobBaseUrl(baseUrl),
	};
}

/** Upload bytes to the Valkey blob cache, returning the CacheRef to hand to the
 * store RPC (`save`/`saveWithHash`). */
async function putCacheBlob(
	cacheBlobBaseUrl: string,
	data: Uint8Array,
): Promise<CacheRef> {
	const response = await fetch(cacheBlobBaseUrl, {
		method: "POST",
		headers: cacheBlobHeaders({ "Content-Type": "application/octet-stream" }),
		body: toArrayBuffer(data),
	});
	if (!response.ok) {
		throw new Error(`Cache blob upload failed: ${response.status}`);
	}
	const ref = (await response.json()) as CacheRef;
	if (!ref?.cacheKey) {
		throw new Error("Cache blob upload returned no cacheKey");
	}
	return ref;
}

/** Fetch the bytes behind a CacheRef returned by the store RPC. */
async function getCacheBlob(
	cacheBlobBaseUrl: string,
	ref: CacheRef,
): Promise<Uint8Array> {
	if (!ref?.cacheKey) {
		throw new Error("Cache reference is missing cacheKey");
	}
	const response = await fetch(
		`${cacheBlobBaseUrl}/${encodeURIComponent(ref.cacheKey)}`,
		{ headers: cacheBlobHeaders() },
	);
	if (!response.ok) {
		throw new Error(`Cache blob download failed: ${response.status}`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

function unwrapResult<T>(value: T | { result: T }): T {
	if (
		value &&
		typeof value === "object" &&
		"result" in value &&
		(value as any).result !== undefined
	) {
		return (value as any).result;
	}
	return value as T;
}

function normalizeCacheRef(value: unknown): CacheRef | undefined {
	const ref = unwrapResult(value as any);
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
	return undefined;
}

async function readStoredChunkBytes(
	clients: StorageClients,
	hash: string,
): Promise<{ data: Uint8Array; compression?: CompressionType | string }> {
	const stored = unwrapResult(await clients.store.getWithMeta(hash));
	if (!stored || typeof stored !== "object") {
		throw new Error(`Store returned invalid metadata for chunk ${hash}`);
	}

	const legacyData = (stored as any).data;
	if (legacyData instanceof Uint8Array) {
		return { data: legacyData, compression: (stored as any).compression };
	}

	const dataRef = normalizeCacheRef((stored as any).dataRef);
	if (dataRef) {
		return {
			data: await getCacheBlob(clients.cacheBlobBaseUrl, dataRef),
			compression: (stored as any).compression,
		};
	}

	throw new Error(`Store metadata for chunk ${hash} has no dataRef/data`);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(data.byteLength);
	copy.set(data);
	return copy.buffer;
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
	const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const result = new Uint8Array(total);
	let offset = 0;

	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result;
}

function hashBytes(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function decompressChunk(
	data: Uint8Array,
	compression: CompressionType | string | undefined,
): Uint8Array {
	switch (compression ?? "none") {
		case "none":
			return data;
		case "deflate":
			return inflateSync(data);
		case "gzip":
			return new Uint8Array(gunzipSync(data));
		case "brotli":
			return new Uint8Array(brotliDecompressSync(data));
		default:
			throw new Error(`Unsupported chunk compression: ${compression}`);
	}
}

export async function readFileFromStorage(
	fileId: string,
	clients = createStorageClients(),
): Promise<StoredFile> {
	const metadata = await clients.files.get(fileId);
	if (!metadata) {
		throw new Error(`File metadata not found: ${fileId}`);
	}

	const chunks = await clients.files.getChunks(fileId);
	if (!chunks.length && metadata.fileSize > 0) {
		throw new Error(`File has no chunks: ${fileId}`);
	}

	const ordered = [...chunks].sort(
		(left, right) => left.chunkNumber - right.chunkNumber,
	);
	const parts: Uint8Array[] = [];

	for (const chunk of ordered) {
		const stored = await readStoredChunkBytes(clients, chunk.hash);
		parts.push(decompressChunk(stored.data, stored.compression));
	}

	return {
		metadata,
		chunks: ordered,
		bytes: concatBytes(parts),
	};
}

export async function saveFileToStorage(
	input: SaveStoredFileInput,
	clients = createStorageClients(),
): Promise<FileMetadata> {
	const fileId = crypto.randomUUID();
	const owner = input.owner ?? "workflow:file-analysis";
	const chunkSize = input.chunkSize ?? DEFAULT_CHUNK_SIZE;
	const chunksCount = Math.max(1, Math.ceil(input.bytes.length / chunkSize));
	const fullHash = hashBytes(input.bytes);
	const createdAt = new Date().toISOString();

	const metadata: FileMetadata = {
		id: fileId,
		hash: fullHash,
		status: "uploaded",
		name: input.name,
		fileSize: input.bytes.length,
		fileType: input.fileType ?? "application/octet-stream",
		compression: "deflate",
		owner,
		createdAt,
		chunksCount,
		...(input.collectionId ? { collectionId: input.collectionId } : {}),
	};

	await clients.files.save(metadata, input.processId);

	for (let index = 0; index < chunksCount; index++) {
		const start = index * chunkSize;
		const end = Math.min(start + chunkSize, input.bytes.length);
		const plain = input.bytes.slice(start, end);
		const compressed = deflateSync(plain);
		const dataRef = await putCacheBlob(clients.cacheBlobBaseUrl, compressed);
		const hash = await clients.store.save(
			dataRef,
			plain.length,
			"deflate",
			owner,
		);

		await clients.files.saveChunk({
			fileId,
			hash,
			chunkNumber: index,
			chunkSize: compressed.length,
			createdAt,
		});
	}

	return metadata;
}
