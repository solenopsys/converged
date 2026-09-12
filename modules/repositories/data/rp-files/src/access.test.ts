import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import metadataMigrations from "./stores/metadata/migrations";
import { MetadataStoreService } from "./stores/metadata/service";
import type { FileMetadata } from "./types";

/**
 * A file record is what access to a file means: the bytes live in `rp-store`
 * content-addressed by hash, and the chunk list is the key to them.
 */
describe("who sees which files", () => {
	let store: SqlStore;
	let metadata: MetadataStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			metadataMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		metadata = new MetadataStoreService(store);
	});

	const file = (
		id: string,
		owner: string,
		name = "report.pdf",
	): FileMetadata => ({
		id,
		hash: `hash-${id}`,
		status: "uploaded",
		name,
		fileSize: 10,
		fileType: "application/pdf",
		compression: "deflate",
		owner,
		createdAt: new Date().toISOString(),
		chunksCount: 1,
	});

	it("lists a file to its owner and to nobody else", async () => {
		await metadata.save(file("f1", "alice"));
		await metadata.save(file("f2", "bob"));

		const forAlice = await as("alice", () =>
			metadata.list({ offset: 0, limit: 10 }),
		);
		expect(forAlice.items.map((f) => f.id)).toEqual(["f1"]);
		expect(forAlice.totalCount).toBe(1);
	});

	it("does not hand a stranger the chunk list, which is the bytes", async () => {
		await metadata.save(file("f1", "alice"));
		expect(await as("bob", () => metadata.get("f1"))).toBeUndefined();
		await as("bob", async () => {
			expect(metadata.getChunks("f1")).rejects.toThrow(AccessDeniedError);
		});
	});

	it("does not let the search text reach across owners", async () => {
		// `key` matches the owner column too, so this used to be a way to list
		// somebody's files by typing their name.
		await metadata.save(file("f1", "alice", "budget.xlsx"));
		await metadata.save(file("f2", "bob", "budget.xlsx"));

		const found = await as("bob", () =>
			metadata.list({ offset: 0, limit: 10, key: "alice" }),
		);
		expect(found.items).toHaveLength(0);
		expect(found.totalCount).toBe(0);
	});

	it("refuses a stranger's update and delete", async () => {
		await metadata.save(file("f1", "alice"));
		await as("bob", async () => {
			expect(metadata.update("f1", { name: "mine.pdf" })).rejects.toThrow(
				AccessDeniedError,
			);
			expect(metadata.delete("f1")).rejects.toThrow(AccessDeniedError);
		});
		expect(
			await as("alice", () => metadata.update("f1", { name: "ok.pdf" })),
		).toBeUndefined();
	});

	it("treats a collection as a grouping, not a grant", async () => {
		const createdAt = new Date().toISOString();
		await metadata.saveCollection({
			id: "c1",
			name: "quarterly",
			owner: "alice",
			createdAt,
		});
		await metadata.save({ ...file("f1", "alice"), collectionId: "c1" });
		await metadata.save({ ...file("f2", "bob"), collectionId: "c1" });

		// Alice opens her collection to Bob; he sees his own file in it and hers
		// only if she opened that too.
		await metadata.access.grantToUser("c1", "bob");
		const forBob = await as("bob", () => metadata.listByCollection("c1"));
		expect(forBob.map((f) => f.id)).toEqual(["f2"]);

		await metadata.access.grantToUser("f1", "bob");
		const widened = await as("bob", () => metadata.listByCollection("c1"));
		expect(widened.map((f) => f.id).sort()).toEqual(["f1", "f2"]);
	});

	it("refuses a collection listing to someone the collection is closed to", async () => {
		await metadata.saveCollection({
			id: "c1",
			name: "quarterly",
			owner: "alice",
			createdAt: new Date().toISOString(),
		});
		await as("dan", async () => {
			expect(metadata.listByCollection("c1")).rejects.toThrow(
				AccessDeniedError,
			);
		});
	});

	it("takes the tags away with the record", async () => {
		await metadata.save(file("f1", "alice"));
		await as("alice", () => metadata.delete("f1"));
		expect(await metadata.access.tagsOf("f1")).toEqual([]);
	});

	it("lets a team see a file opened to its tag", async () => {
		await metadata.save(file("f1", "alice"));
		await metadata.access.grant("f1", "team-audit");
		const forAuditor = await as(
			"auditor",
			() => metadata.list({ offset: 0, limit: 10 }),
			["team-audit"],
		);
		expect(forAuditor.items.map((f) => f.id)).toEqual(["f1"]);
	});
});
