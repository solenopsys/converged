import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import type { FileMetadata } from "../../types";
import CreateFilesMigration from "./migrations/createFiles";
import { MetadataStoreService } from "./service";

describe("MetadataStoreService.list", () => {
	let store: SqlStore;
	let metadataService: MetadataStoreService;

	beforeAll(async () => {
		store = new SqlStore(
			":memory:",
			[CreateFilesMigration],
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		metadataService = new MetadataStoreService(store);

		const files: FileMetadata[] = [
			{
				id: "list-alpha-file",
				hash: "",
				status: "uploaded",
				name: "files-list-alpha.pdf",
				fileSize: 10,
				fileType: "application/pdf",
				compression: "none",
				owner: "alice",
				createdAt: "2026-01-02T00:00:00.000Z",
				chunksCount: 1,
			},
			{
				id: "list-beta-file",
				hash: "",
				status: "uploaded",
				name: "files-list-beta.pdf",
				fileSize: 20,
				fileType: "application/pdf",
				compression: "none",
				owner: "bob",
				createdAt: "2026-01-03T00:00:00.000Z",
				chunksCount: 1,
			},
		];

		for (const file of files) await metadataService.save(file);
	});

	afterAll(async () => {
		await store.close();
	});

	it("filters and pages without loading every record", async () => {
		const filtered = await metadataService.list({
			key: "files-list-alpha",
			offset: 0,
			limit: 20,
		});
		expect(filtered.totalCount).toBe(1);
		expect(filtered.items.map((file) => file.id)).toEqual(["list-alpha-file"]);

		const firstPage = await metadataService.list({
			key: "files-list",
			offset: 0,
			limit: 1,
		});
		expect(firstPage.items).toHaveLength(1);
		expect(firstPage.totalCount).toBe(2);
	});
});
