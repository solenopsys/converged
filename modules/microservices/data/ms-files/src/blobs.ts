// Blob plumbing for the contract.md workflow methods (materialize / detectType /
// unzip / persist). Heavy bytes are staged in Valkey as CacheRef values and the
// chunks themselves live in ms-store, which is the one content-addressed store:
// it keys blocks by hash, so the same bytes are kept once, and it counts the
// references, so a block goes away only with the last file that holds it.
// ms-files keeps names, collections and the chunk list — metadata, no data.

import { createHash } from "node:crypto";
import { extname, join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import type { CacheAdapter, FileStore } from "back-core";
import { CACHE_BLOB_TTL_SECONDS } from "back-core";
import { deflateSync, inflateSync } from "fflate";
import type { CacheRef } from "g-files";

export const DEFAULT_CHUNK_SIZE = 512 * 1024;

export function hashBytes(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

// ---- Valkey cache blob IO ---------------------------------------------------

export async function readCacheRef(
	cache: CacheAdapter,
	ref: CacheRef,
): Promise<Uint8Array> {
	if (!ref?.cacheKey) {
		throw new Error("Cache reference is missing cacheKey");
	}
	const bytes = await cache.getBytes(ref.cacheKey);
	if (!bytes) {
		throw new Error(`Cache blob not found or expired: ${ref.cacheKey}`);
	}
	return bytes;
}

export async function writeCacheRef(
	cache: CacheAdapter,
	bytes: Uint8Array,
	...keySegments: Array<string | number>
): Promise<CacheRef> {
	const cacheKey = cache.buildKey("files", ...keySegments, crypto.randomUUID());
	await cache.setBytes(cacheKey, bytes, CACHE_BLOB_TTL_SECONDS);
	return { cacheKey, sizeBytes: bytes.byteLength };
}

// ---- chunk (ms-store) IO ----------------------------------------------------

export function decompressChunk(
	data: Uint8Array,
	compression: string | undefined,
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

/** The codec every chunk in the system is written with. */
export function deflateChunk(plain: Uint8Array): Uint8Array {
	return deflateSync(plain);
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
	const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return result;
}

// ---- file type detection (port of the old engine's lib/file-types.ts) ------

export type DetectedFileType =
	| "zip"
	| "step"
	| "stl"
	| "obj"
	| "ply"
	| "3mf"
	| "glb"
	| "gltf"
	| "gcode"
	| "dxf"
	| "pdf"
	| "image"
	| "text"
	| "unknown";

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
	if (bytes.length < signature.length) return false;
	return signature.every((value, index) => bytes[index] === value);
}

function looksLikeText(bytes: Uint8Array): boolean {
	const sample = bytes.slice(0, Math.min(bytes.length, 512));
	if (sample.length === 0) return true;
	let printable = 0;
	for (const byte of sample) {
		if (
			byte === 9 ||
			byte === 10 ||
			byte === 13 ||
			(byte >= 32 && byte <= 126)
		) {
			printable++;
		}
	}
	return printable / sample.length > 0.9;
}

function textPrefix(bytes: Uint8Array): string {
	return new TextDecoder()
		.decode(bytes.slice(0, Math.min(bytes.length, 256)))
		.trimStart()
		.toLowerCase();
}

export function contentTypeForName(
	name: string,
	fallback = "application/octet-stream",
): string {
	const extension = extname(name).toLowerCase();
	switch (extension) {
		case ".zip":
			return "application/zip";
		case ".step":
		case ".stp":
			return "model/step";
		case ".stl":
			return "model/stl";
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
		case ".json":
			return "application/json";
		case ".txt":
			return "text/plain";
		default:
			return fallback;
	}
}

export function detectFileType(
	name: string,
	bytes: Uint8Array,
): { type: DetectedFileType; mime: string } {
	const extension = extname(name).toLowerCase();
	const prefix = textPrefix(bytes);

	let type: DetectedFileType = "unknown";

	if (extension === ".3mf") {
		type = "3mf";
	} else if (
		startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
		extension === ".zip"
	) {
		type = "zip";
	} else if (
		startsWith(bytes, [0x67, 0x6c, 0x54, 0x46]) ||
		extension === ".glb"
	) {
		type = "glb";
	} else if (
		startsWith(bytes, [0x25, 0x50, 0x44, 0x46]) ||
		extension === ".pdf"
	) {
		type = "pdf";
	} else if (
		extension === ".step" ||
		extension === ".stp" ||
		prefix.includes("iso-10303-21")
	) {
		type = "step";
	} else if (extension === ".stl" || prefix.startsWith("solid ")) {
		type = "stl";
	} else if (extension === ".obj") {
		type = "obj";
	} else if (extension === ".ply" || prefix.startsWith("ply")) {
		type = "ply";
	} else if (extension === ".gltf") {
		type = "gltf";
	} else if ([".gcode", ".nc", ".tap"].includes(extension)) {
		type = "gcode";
	} else if (extension === ".dxf") {
		type = "dxf";
	} else if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
		type = "image";
	} else if (looksLikeText(bytes)) {
		type = "text";
	}

	return { type, mime: contentTypeForName(name) };
}
