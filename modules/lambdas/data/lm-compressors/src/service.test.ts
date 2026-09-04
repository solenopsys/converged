import { describe, expect, test } from "bun:test";
import type { CacheAdapter } from "back-core";
import { inflateSync, zipSync } from "fflate";
import { CompressorsServiceImpl } from "./service";

function createCache(): CacheAdapter {
	const values = new Map<string, Uint8Array>();
	return {
		url: "memory://compressors",
		keyPrefix: "test",
		defaultTtlSeconds: 60,
		buildKey: (...segments) => segments.join(":"),
		get: async (key) => {
			const value = values.get(key);
			return value ? new TextDecoder().decode(value) : null;
		},
		set: async (key, value) => values.set(key, new TextEncoder().encode(value)),
		getBytes: async (key) => values.get(key) ?? null,
		setBytes: async (key, value) => values.set(key, new Uint8Array(value)),
		del: async (key) => values.delete(key),
		getJson: async () => null,
		setJson: async () => {},
		close: () => {},
	};
}

describe("CompressorsService", () => {
	test("unpacks Valkey-backed ZIP chunks and returns Valkey-backed entries", async () => {
		const cache = createCache();
		const source = zipSync({
			"models/part.stl": new TextEncoder().encode("solid part"),
			"notes.txt": new TextEncoder().encode("notes"),
			"__MACOSX/.ignored": new Uint8Array([1]),
		});
		const inputRef = { cacheKey: "input:zip", sizeBytes: source.byteLength };
		await cache.setBytes(inputRef.cacheKey, source);

		const service = new CompressorsServiceImpl({ cache });
		const result = await service.unpack({
			name: "upload.zip",
			chunks: [
				{ ref: inputRef, compression: "none", originalSize: source.byteLength },
			],
		});

		expect(result.entries.map((entry) => entry.name)).toEqual([
			"part.stl",
			"notes.txt",
		]);
		expect(result.entries[0].fileType).toBe("model/stl");
		const stored = await cache.getBytes(
			result.entries[0].chunks[0].ref.cacheKey,
		);
		expect(stored).not.toBeNull();
		if (!stored) return;
		expect(new TextDecoder().decode(inflateSync(stored))).toBe("solid part");
	});
});
