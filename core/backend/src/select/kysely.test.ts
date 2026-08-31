import { describe, expect, test } from "bun:test";
import { Kysely } from "kysely";
import { BunSqliteLocal } from "../engines/sqlite/bun-sqlite-dialect";
import { applyKyselyFilter } from "./kysely";
import type { KyselyFilterSchema } from "./kysely";

const schema: KyselyFilterSchema = {
	status: {
		valueType: "string",
		operators: ["eq", "in"],
		values: ["active", "inactive"],
		column: "status",
	},
	missingImage: {
		valueType: "boolean",
		operators: ["eq"],
		compile: (eb, condition) =>
			condition.value === true
				? eb("imageKey", "is", null)
				: eb("imageKey", "is not", null),
	},
};

describe("Kysely select adapter", () => {
	test("compiles declared and custom fields safely", async () => {
		const sqlite = new BunSqliteLocal(":memory:");
		try {
			sqlite.db.exec(`
				create table items (id text primary key, status text not null, imageKey text);
				insert into items values ('a', 'active', null), ('b', 'active', 'image'), ('c', 'inactive', null);
			`);
			const db = new Kysely<any>({ dialect: sqlite.dialect });
			try {
				const query = applyKyselyFilter(
					db.selectFrom("items").selectAll() as any,
					{ status: { eq: "active" }, missingImage: { eq: true } },
					schema,
				) as any;
				expect(await query.execute()).toEqual([
					{ id: "a", status: "active", imageKey: null },
				]);
			} finally {
				await db.destroy();
			}
		} finally {
			sqlite.close();
		}
	});
});
