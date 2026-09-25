import { afterEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState } from "../../migrations";
import { BaseRepositorySQL } from "./sql-repository";
import { SqlStore } from "./sql-store";

type EntryKey = { tenant: string; id: string };
type Entry = EntryKey & { value: string };

describe("BaseRepositorySQL.deleteMany", () => {
	let store: SqlStore | undefined;

	afterEach(async () => {
		await store?.close();
	});

	it("deletes only supplied composite keys across batches", async () => {
		store = new SqlStore(":memory:", [], new InMemoryMigrationState());
		await store.open();
		await store.db.schema
			.createTable("entries")
			.addColumn("tenant", "text", (column) => column.notNull())
			.addColumn("id", "text", (column) => column.notNull())
			.addColumn("value", "text", (column) => column.notNull())
			.execute();

		const repository = new BaseRepositorySQL<EntryKey, Entry>(
			store,
			"entries",
			{
				primaryKey: ["tenant", "id"],
				extractKey: ({ tenant, id }) => ({ tenant, id }),
				buildWhereCondition: ({ tenant, id }) => ({ tenant, id }),
			},
		);
		const keys = Array.from({ length: 205 }, (_, index) => ({
			tenant: "a",
			id: `entry-${index}`,
		}));
		await store.db
			.insertInto("entries")
			.values([
				...keys.map((key) => ({ ...key, value: "remove" })),
				{ tenant: "b", id: "entry-0", value: "keep" },
			])
			.execute();

		expect(await repository.deleteMany([])).toBe(0);
		expect(await repository.deleteMany(keys)).toBe(205);
		expect(
			await repository.findById({ tenant: "b", id: "entry-0" }),
		).toMatchObject({
			value: "keep",
		});
		expect(await repository.deleteMany(keys)).toBe(0);
		expect(
			await store.db
				.transaction()
				.execute((trx) =>
					repository.deleteMany([{ tenant: "b", id: "entry-0" }], trx),
				),
		).toBe(1);
	});
});
