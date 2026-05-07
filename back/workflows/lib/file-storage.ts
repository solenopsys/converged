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
	type CompressionType,
	createStoreServiceClient,
	type StoreServiceClient,
} from "g-store";

const DEFAULT_CHUNK_SIZE = 512 * 1024;

export type StorageClients = {
	files: FilesServiceClient;
	store: StoreServiceClient;
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
};

export function createStorageClients(
	baseUrl = process.env.SERVICES_BASE,
): StorageClients {
	return {
		files: createFilesServiceClient({ baseUrl }),
		store: createStoreServiceClient({ baseUrl }),
	};
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
		const stored = await clients.store.getWithMeta(chunk.hash);
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
	};

	await clients.files.save(metadata);

	for (let index = 0; index < chunksCount; index++) {
		const start = index * chunkSize;
		const end = Math.min(start + chunkSize, input.bytes.length);
		const plain = input.bytes.slice(start, end);
		const compressed = deflateSync(plain);
		const hash = await clients.store.save(
			compressed,
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
