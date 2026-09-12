import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import metadataMigrations from "./stores/metadata/migrations";
import { ChunkMetadataService } from "./stores/metadata/service";

/**
 * Blocks are content-addressed and deduplicated, so the same bytes genuinely
 * belong to several people at once. Reading one by hash is not narrowed —
 * a SHA-256 is a secret derived from the content — but enumerating them is.
 */
describe("who holds which blocks", () => {
	let store: SqlStore;
	let chunks: ChunkMetadataService;

	const as = <T>(user: string, fn: () => T) =>
		runWithWorkspaceContext({ user }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			metadataMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		chunks = new ChunkMetadataService(store);
	});

	it("lists a block to each of its holders and to nobody else", async () => {
		await chunks.save("hash-a", 10, 10, "deflate", "alice");
		await chunks.save("hash-b", 10, 10, "deflate", "bob");

		expect((await as("alice", () => chunks.list(10, 0))).items).toEqual([
			"hash-a",
		]);
		expect((await as("dan", () => chunks.list(10, 0))).totalCount).toBe(0);
	});

	it("gives the same deduplicated block to everyone who stored it", async () => {
		await chunks.save("hash-a", 10, 10, "deflate", "alice");
		await chunks.save("hash-a", 10, 10, "deflate", "bob");

		expect((await chunks.get("hash-a"))?.refCount).toBe(2);
		expect((await as("alice", () => chunks.list(10, 0))).items).toEqual([
			"hash-a",
		]);
		expect((await as("bob", () => chunks.list(10, 0))).items).toEqual([
			"hash-a",
		]);
	});

	it("drops a holder's tag when they release it, keeping the block for the rest", async () => {
		await chunks.save("hash-a", 10, 10, "deflate", "alice");
		await chunks.save("hash-a", 10, 10, "deflate", "bob");

		expect(await chunks.decrementRef("hash-a", "bob")).toBe(false);
		expect((await as("bob", () => chunks.list(10, 0))).totalCount).toBe(0);
		expect((await as("alice", () => chunks.list(10, 0))).items).toEqual([
			"hash-a",
		]);

		expect(await chunks.decrementRef("hash-a", "alice")).toBe(true);
		expect(await chunks.access.tagsOf("hash-a")).toEqual([]);
	});

	it("counts and sizes only the caller's own blocks", async () => {
		await chunks.save("hash-a", 10, 10, "deflate", "alice");
		await chunks.save("hash-b", 30, 30, "deflate", "bob");

		const forAlice = await as("alice", () => chunks.statistic());
		expect(forAlice.totalChunks).toBe(1);
		expect(forAlice.totalSize).toBe(10);
		expect((await as("dan", () => chunks.statistic())).totalChunks).toBe(0);
	});
});
