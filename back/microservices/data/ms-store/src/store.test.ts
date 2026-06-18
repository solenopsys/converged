import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { StoreServiceImpl } from "./service";
import type { CacheAdapter } from "back-core";

function createTestCache(): CacheAdapter {
	const values = new Map<string, Uint8Array | string>();
	const buildKey = (...segments: Array<string | number>) =>
		["test", ...segments].join(":");
	return {
		url: "memory://test",
		keyPrefix: "test",
		defaultTtlSeconds: 120,
		buildKey,
		get: async (key) => {
			const value = values.get(key);
			if (typeof value === "string") return value;
			if (value instanceof Uint8Array) return new TextDecoder().decode(value);
			return null;
		},
		set: async (key, value) => {
			values.set(key, value);
		},
		getBytes: async (key) => {
			const value = values.get(key);
			if (value instanceof Uint8Array) return value;
			if (typeof value === "string") return new TextEncoder().encode(value);
			return null;
		},
		setBytes: async (key, value) => {
			values.set(key, new Uint8Array(value));
		},
		del: async (key) => {
			values.delete(key);
		},
		getJson: async (key) => {
			const raw = values.get(key);
			if (typeof raw !== "string") return null;
			return JSON.parse(raw);
		},
		setJson: async (key, value) => {
			values.set(key, JSON.stringify(value));
		},
		close: () => {},
	};
}

describe("StoreService", () => {
	let tempDir = "";
	let cwd = "";
	let service: StoreServiceImpl;
	let cache: CacheAdapter;

	beforeAll(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "store-test-"));
		cwd = process.cwd();
		process.chdir(tempDir);

		cache = createTestCache();
		service = new StoreServiceImpl({ cache });
		await service.init();
	});

	afterAll(async () => {
		if (service?.stores) {
			await service.stores.destroy();
		}
		process.chdir(cwd);
		await rm(tempDir, { recursive: true, force: true });
	});

	it("saves and reads data", async () => {
		const data = new TextEncoder().encode("hello-store");
		const inputRef = {
			cacheKey: cache.buildKey("input", crypto.randomUUID()),
			sizeBytes: data.length,
		};
		await cache.setBytes(inputRef.cacheKey, data);
		const hash = await service.save(inputRef, data.length, "none", "tester");

		const exists = await service.exists(hash);
		expect(exists).toBe(true);

		const readRef = await service.get(hash);
		const read = await cache.getBytes(readRef.cacheKey);
		expect(read).not.toBeNull();
		expect(Buffer.from(read!).toString()).toBe("hello-store");

		const list = await service.list({ key: "", offset: 0, limit: 10 });
		expect(list.items.includes(hash)).toBe(true);
	});

	it("respects refCount on delete", async () => {
		const data = new TextEncoder().encode("same-data");
		const hash = "deadbeefdeadbeef";
		const inputRef = {
			cacheKey: cache.buildKey("input", crypto.randomUUID()),
			sizeBytes: data.length,
		};
		await cache.setBytes(inputRef.cacheKey, data);

		await service.saveWithHash(hash, inputRef);
		await service.saveWithHash(hash, inputRef);

		await service.delete(hash);
		expect(await service.exists(hash)).toBe(true);

		await service.delete(hash);
		expect(await service.exists(hash)).toBe(false);
	});
});
