import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Kysely } from "../../../../../../../../core/backend/node_modules/kysely";
import { BunSqliteLocal } from "../../../../../../../../core/backend/src/engines/sqlite/bun-sqlite-dialect";
import migrations from "./migrations";
import { GeoCountryStoreService } from "./service";

describe("GeoCountryStoreService", () => {
	let local: BunSqliteLocal;
	let db: Kysely<Record<string, unknown>>;
	let service: GeoCountryStoreService;

	beforeEach(async () => {
		local = new BunSqliteLocal(":memory:");
		db = new Kysely({ dialect: local.dialect });
		for (const Migration of migrations) {
			await new Migration({ db } as never).up();
		}
		service = new GeoCountryStoreService({ db } as never);
	});

	afterEach(async () => {
		await db.destroy();
		local.close();
	});

	it("inserts a full 1000-network import batch", async () => {
		const entries = Array.from({ length: 1_000 }, (_, index) => ({
			network: `192.0.${Math.floor(index / 256)}.${index % 256}/32`,
			country_code: "US",
			country_name: "United States",
		}));

		expect(await service.importBatch("import-1", entries)).toBe(1_000);
		const result = await db
			.selectFrom("geolite_country_networks")
			.select(({ fn }) => fn.countAll().as("count"))
			.executeTakeFirst();
		expect(Number(result?.count)).toBe(1_000);
	});
});
