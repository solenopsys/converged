import { type SqlStore, sql } from "back-core";
import type { GeoLiteCountryNetworkInput } from "../../../types";
import { ipToRange, parseIpAddress } from "../network";

const TABLE = "geolite_country_networks";
const IMPORT_BATCH_LIMIT = 1_000;

export type GeoCountry = {
	network: string;
	country_code: string;
	country_name: string;
	geoname_id: number | null;
	registered_country_geoname_id: number | null;
};

export class GeoCountryStoreService {
	constructor(private readonly store: SqlStore) {}

	async importBatch(
		importId: string,
		entries: GeoLiteCountryNetworkInput[],
	): Promise<number> {
		if (!entries.length) return 0;
		if (entries.length > IMPORT_BATCH_LIMIT)
			throw new Error("GeoLite country batches are limited to 1000 networks");
		const updatedAt = Date.now();
		const rows = entries.map((entry) => ({
			network: entry.network,
			...ipToRange(entry.network),
			country_code: entry.country_code?.trim().toUpperCase() ?? "",
			country_name:
				entry.country_name?.trim() ||
				entry.country_code?.trim().toUpperCase() ||
				"",
			geoname_id: entry.geoname_id ?? null,
			registered_country_geoname_id:
				entry.registered_country_geoname_id ?? null,
			import_id: importId,
			updated_at: updatedAt,
		}));
		await this.store.db
			.insertInto(TABLE)
			.values(rows)
			.onConflict((conflict) =>
				conflict.column("network").doUpdateSet({
					address_family: sql`excluded.address_family`,
					network_start: sql`excluded.network_start`,
					network_end: sql`excluded.network_end`,
					prefix_length: sql`excluded.prefix_length`,
					country_code: sql`excluded.country_code`,
					country_name: sql`excluded.country_name`,
					geoname_id: sql`excluded.geoname_id`,
					registered_country_geoname_id: sql`excluded.registered_country_geoname_id`,
					import_id: sql`excluded.import_id`,
					updated_at: sql`excluded.updated_at`,
				}),
			)
			.execute();
		return rows.length;
	}

	async clear(): Promise<void> {
		await this.store.db.deleteFrom(TABLE).execute();
	}

	async completeImport(importId: string): Promise<number> {
		await this.store.db
			.deleteFrom(TABLE)
			.where("import_id", "<>", importId)
			.execute();
		const result = await this.store.db
			.selectFrom(TABLE)
			.select(({ fn }) => fn.countAll().as("count"))
			.executeTakeFirst();
		return Number(result?.count ?? 0);
	}

	async lookup(ip: string): Promise<GeoCountry | undefined> {
		const address = parseIpAddress(ip);
		if (!address) return undefined;
		return this.store.db
			.selectFrom(TABLE)
			.select([
				"network",
				"country_code",
				"country_name",
				"geoname_id",
				"registered_country_geoname_id",
			])
			.where("address_family", "=", address.family)
			.where("network_start", "<=", address.hex)
			.where("network_end", ">=", address.hex)
			.orderBy("prefix_length", "desc")
			.limit(1)
			.executeTakeFirst();
	}

	async list(limit: number, offset: number) {
		const [items, total] = await Promise.all([
			this.store.db
				.selectFrom(`${TABLE} as network`)
				.leftJoin("geolite_locations as location", (join) =>
					join
						.onRef("location.geoname_id", "=", "network.geoname_id")
						.on("location.dataset", "=", "country"),
				)
				.select([
					"network.network as network",
					"location.country_code as country_code",
					"location.country_name as country_name",
					"network.geoname_id as geoname_id",
					"network.registered_country_geoname_id as registered_country_geoname_id",
				])
				.orderBy("network.network", "asc")
				.limit(limit)
				.offset(offset)
				.execute(),
			this.store.db
				.selectFrom(TABLE)
				.select(({ fn }) => fn.countAll().as("count"))
				.executeTakeFirst(),
		]);
		return { items, totalCount: Number(total?.count ?? 0) };
	}
}
