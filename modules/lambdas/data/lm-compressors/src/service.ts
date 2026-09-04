import { createHash } from "node:crypto";
import { basename, extname } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { CACHE_BLOB_TTL_SECONDS, type CacheAdapter } from "back-core";
import { deflateSync, inflateSync, unzipSync } from "fflate";
import type {
	ArchiveUnpackInput,
	ArchiveUnpackResult,
	CompressedChunk,
	CompressionType,
	CompressorsService,
	ProducedChunk,
} from "g-compressors";

const CHUNK_SIZE = 512 * 1024;

function decompress(
	data: Uint8Array,
	compression: CompressionType,
): Uint8Array {
	switch (compression) {
		case "none":
			return data;
		case "deflate":
			return inflateSync(data);
		case "gzip":
			return new Uint8Array(gunzipSync(data));
		case "brotli":
			return new Uint8Array(brotliDecompressSync(data));
	}
}

function concat(chunks: Uint8Array[]): Uint8Array {
	const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
	const output = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		output.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return output;
}

function hash(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function contentType(name: string): string {
	switch (extname(name).toLowerCase()) {
		case ".stl":
			return "model/stl";
		case ".step":
		case ".stp":
			return "model/step";
		case ".obj":
			return "model/obj";
		case ".ply":
			return "model/ply";
		case ".3mf":
			return "model/3mf";
		case ".glb":
			return "model/gltf-binary";
		case ".gltf":
			return "model/gltf+json";
		case ".gcode":
		case ".nc":
		case ".tap":
			return "text/x-gcode";
		case ".dxf":
			return "image/vnd.dxf";
		case ".pdf":
			return "application/pdf";
		case ".txt":
			return "text/plain";
		default:
			return "application/octet-stream";
	}
}

function isSafeEntry(path: string, data: Uint8Array): boolean {
	if (path.endsWith("/") || data.byteLength === 0) return false;
	const segments = path.split("/");
	return (
		!segments.some((segment) => segment === "" || segment === "..") &&
		segments[0] !== "__MACOSX" &&
		!basename(path).startsWith(".")
	);
}

export class CompressorsServiceImpl implements CompressorsService {
	private readonly cache?: CacheAdapter;

	constructor(config?: { cache?: CacheAdapter; valkey?: CacheAdapter }) {
		this.cache = config?.cache ?? config?.valkey;
	}

	private requiredCache(): CacheAdapter {
		if (!this.cache) {
			throw new Error("lm-compressors requires the Valkey cache adapter");
		}
		return this.cache;
	}

	private async readChunks(chunks: CompressedChunk[]): Promise<Uint8Array> {
		const cache = this.requiredCache();
		const parts: Uint8Array[] = [];
		for (const chunk of chunks) {
			const data = await cache.getBytes(chunk.ref.cacheKey);
			if (!data) throw new Error(`Cache blob not found: ${chunk.ref.cacheKey}`);
			parts.push(decompress(data, chunk.compression));
		}
		return concat(parts);
	}

	private async writeChunks(
		bytes: Uint8Array,
		name: string,
	): Promise<ProducedChunk[]> {
		const cache = this.requiredCache();
		const chunks: ProducedChunk[] = [];
		for (
			let offset = 0, index = 0;
			offset < bytes.byteLength || index === 0;
			index++
		) {
			const part = bytes.slice(
				offset,
				Math.min(offset + CHUNK_SIZE, bytes.byteLength),
			);
			offset += CHUNK_SIZE;
			const compressed = deflateSync(part);
			const cacheKey = cache.buildKey(
				"compressors",
				"unpack",
				crypto.randomUUID(),
				index,
				name,
			);
			await cache.setBytes(cacheKey, compressed, CACHE_BLOB_TTL_SECONDS);
			chunks.push({
				ref: { cacheKey, sizeBytes: compressed.byteLength },
				compression: "deflate",
				originalSize: part.byteLength,
			});
		}
		return chunks;
	}

	async unpack(input: ArchiveUnpackInput): Promise<ArchiveUnpackResult> {
		if (!input?.name || !input.chunks?.length) {
			throw new Error("archive name and chunks are required");
		}

		const archive = unzipSync(await this.readChunks(input.chunks));
		const entries: ArchiveUnpackResult["entries"] = [];
		for (const [path, bytes] of Object.entries(archive)) {
			if (!isSafeEntry(path, bytes)) continue;
			const name = basename(path);
			entries.push({
				name,
				fileType: contentType(name),
				hash: hash(bytes),
				fileSize: bytes.byteLength,
				chunks: await this.writeChunks(bytes, name),
			});
		}
		return { entries };
	}
}
