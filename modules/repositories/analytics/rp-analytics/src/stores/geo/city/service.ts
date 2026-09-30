import { type SqlStore, sql } from "back-core";
import type {
	GeoLiteCityNetworkInput,
	GeoLiteLocationInput,
} from "../../../types";
import { ipToRange, parseIpAddress } from "../network";

const NETWORKS = "geolite_city_networks";
const LOCATIONS = "geolite_locations";
const BATCH_LIMIT = 1_000;

export class GeoCityStoreService {
	constructor(private readonly store: SqlStore) {}

	async importNetworkBatch(
		importId: string,
		entries: GeoLiteCityNetworkInput[],
	): Promise<number> {
		if (!entries.length) return 0;
		if (entries.length > BATCH_LIMIT)
			throw new Error("GeoLite city batches are limited to 1000 networks");
		const updatedAt = Date.now();
		const rows = entries.map((entry) => ({
			network: entry.network,
			...ipToRange(entry.network),
			geoname_id: entry.geoname_id ?? null,
			registered_country_geoname_id:
				entry.registered_country_geoname_id ?? null,
			import_id: importId,
			updated_at: updatedAt,
		}));
		await this.store.db
			.insertInto(NETWORKS)
			.values(rows)
			.onConflict((conflict) =>
				conflict.column("network").doUpdateSet({
					address_family: sql`excluded.address_family`,
					network_start: sql`excluded.network_start`,
					network_end: sql`excluded.network_end`,
					prefix_length: sql`excluded.prefix_length`,
					geoname_id: sql`excluded.geoname_id`,
					registered_country_geoname_id: sql`excluded.registered_country_geoname_id`,
					import_id: sql`excluded.import_id`,
					updated_at: sql`excluded.updated_at`,
				}),
			)
			.execute();
		return rows.length;
	}

	async importLocationsBatch(
		importId: string,
		dataset: GeoLiteLocationInput["dataset"],
		entries: GeoLiteLocationInput[],
	): Promise<number> {
		if (!entries.length) return 0;
		if (entries.length > BATCH_LIMIT)
			throw new Error("GeoLite location batches are limited to 1000 rows");
		const updatedAt = Date.now();
		const rows = entries.map((entry) => ({
			...entry,
			dataset,
			import_id: importId,
			updated_at: updatedAt,
		}));
		await this.store.db
			.insertInto(LOCATIONS)
			.values(rows)
			.onConflict((conflict) =>
				conflict.columns(["dataset", "geoname_id"]).doUpdateSet({
					continent_code: sql`excluded.continent_code`,
					continent_name: sql`excluded.continent_name`,
					country_code: sql`excluded.country_code`,
					country_name: sql`excluded.country_name`,
					region_code: sql`excluded.region_code`,
					region_name: sql`excluded.region_name`,
					city_name: sql`excluded.city_name`,
					time_zone: sql`excluded.time_zone`,
					import_id: sql`excluded.import_id`,
					updated_at: sql`excluded.updated_at`,
				}),
			)
			.execute();
		return rows.length;
	}

	async completeNetworks(importId: string): Promise<number> {
		await this.store.db
			.deleteFrom(NETWORKS)
			.where("import_id", "<>", importId)
			.execute();
		return this.count(NETWORKS);
	}

	async completeLocations(
		dataset: GeoLiteLocationInput["dataset"],
		importId: string,
	): Promise<number> {
		await this.store.db
			.deleteFrom(LOCATIONS)
			.where("dataset", "=", dataset)
			.where("import_id", "<>", importId)
			.execute();
		return this.count(LOCATIONS, dataset);
	}

	async lookup(ip: string) {
		const address = parseIpAddress(ip);
		if (!address) return undefined;
		return this.store.db
			.selectFrom(NETWORKS)
			.select(["network", "geoname_id", "registered_country_geoname_id"])
			.where("address_family", "=", address.family)
			.where("network_start", "<=", address.hex)
			.where("network_end", ">=", address.hex)
			.orderBy("prefix_length", "desc")
			.limit(1)
			.executeTakeFirst();
	}

	async lookupLocation(dataset: "country" | "city", geonameId: number) {
		return this.store.db
			.selectFrom(LOCATIONS)
			.select(["country_code", "country_name", "region_name", "city_name"])
			.where("dataset", "=", dataset)
			.where("geoname_id", "=", geonameId)
			.executeTakeFirst();
	}

	async list(limit: number, offset: number) {
		const [items, total] = await Promise.all([
			this.store.db
				.selectFrom(`${NETWORKS} as network`)
				.leftJoin(`${LOCATIONS} as location`, (join) =>
					join
						.onRef("location.geoname_id", "=", "network.geoname_id")
						.on("location.dataset", "=", "city"),
				)
				.select([
					"network.network as network",
					"network.geoname_id as geoname_id",
					"network.registered_country_geoname_id as registered_country_geoname_id",
					"location.country_code as country_code",
					"location.country_name as country_name",
					"location.region_name as region_name",
					"location.city_name as city_name",
				])
				.orderBy("network.network", "asc")
				.limit(limit)
				.offset(offset)
				.execute(),
			this.store.db
				.selectFrom(NETWORKS)
				.select(({ fn }) => fn.countAll().as("count"))
				.executeTakeFirst(),
		]);
		return { items, totalCount: Number(total?.count ?? 0) };
	}

	async status() {
		const [country, city] = await Promise.all([
			this.statusRow("country"),
			this.statusRow("city"),
		]);
		return [country, city];
	}

	async saveStatus(
		dataset: "country" | "city" | "asn",
		records: number,
	): Promise<void> {
		await this.store.db
			.insertInto("geolite_import_status")
			.values({ dataset, records, updated_at: Date.now() })
			.onConflict((conflict) =>
				conflict.column("dataset").doUpdateSet({
					records: sql`excluded.records`,
					updated_at: sql`excluded.updated_at`,
				}),
			)
			.execute();
	}

	async statusRow(dataset: "country" | "city" | "asn") {
		const row = await this.store.db
			.selectFrom("geolite_import_status")
			.select(["records", "updated_at"])
			.where("dataset", "=", dataset)
			.executeTakeFirst();
		return {
			dataset,
			records: Number(row?.records ?? 0),
			updated_at: Number(row?.updated_at ?? 0),
		};
	}

	private async count(
		table: typeof NETWORKS | typeof LOCATIONS,
		dataset?: string,
	) {
		let query = this.store.db
			.selectFrom(table)
			.select(({ fn }) => fn.countAll().as("count"));
		if (dataset) query = query.where("dataset", "=", dataset) as typeof query;
		const row = await query.executeTakeFirst();
		return Number(row?.count ?? 0);
	}
}
