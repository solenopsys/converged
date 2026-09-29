import { sql, SqlStore } from "back-core";
import type { GeoLiteCountryNetworkInput } from "../../../types";
import { ipToRange, parseIpAddress } from "../network";

const TABLE = "geolite_country_networks";
const IMPORT_BATCH_LIMIT = 5_000;

export type GeoCountry = { country_code: string; country_name: string };

export class GeoCountryStoreService {
	constructor(private readonly store: SqlStore) {}

	async importBatch(entries: GeoLiteCountryNetworkInput[]): Promise<number> {
		if (!entries.length) return 0;
		if (entries.length > IMPORT_BATCH_LIMIT)
			throw new Error("GeoLite country batches are limited to 5000 networks");
		const rows = entries.map((entry) => ({
			network: entry.network,
			...ipToRange(entry.network),
			country_code: entry.country_code.trim().toUpperCase(),
			country_name:
				entry.country_name?.trim() || entry.country_code.trim().toUpperCase(),
		}));
		for (let index = 0; index < rows.length; index += 100) {
			await this.store.db
				.insertInto(TABLE)
				.values(rows.slice(index, index + 100))
				.onConflict((conflict) =>
					conflict.column("network").doUpdateSet({
						address_family: sql`excluded.address_family`,
						network_start: sql`excluded.network_start`,
						network_end: sql`excluded.network_end`,
						prefix_length: sql`excluded.prefix_length`,
						country_code: sql`excluded.country_code`,
						country_name: sql`excluded.country_name`,
					}),
				)
				.execute();
		}
		return rows.length;
	}

	async clear(): Promise<void> {
		await this.store.db.deleteFrom(TABLE).execute();
	}

	async lookup(ip: string): Promise<GeoCountry | undefined> {
		const address = parseIpAddress(ip);
		if (!address) return undefined;
		return this.store.db
			.selectFrom(TABLE)
			.select(["country_code", "country_name"])
			.where("address_family", "=", address.family)
			.where("network_start", "<=", address.hex)
			.where("network_end", ">=", address.hex)
			.orderBy("prefix_length", "desc")
			.limit(1)
			.executeTakeFirst();
	}
}
