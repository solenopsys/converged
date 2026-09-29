import { sql, SqlStore } from "back-core";
import type { GeoLiteAsnNetworkInput } from "../../../types";
import { ipToRange, parseIpAddress } from "../network";

const TABLE = "geolite_asn_networks";
const IMPORT_BATCH_LIMIT = 5_000;

export type GeoAsn = { asn: number; organization: string };

export class GeoAsnStoreService {
	constructor(private readonly store: SqlStore) {}

	async importBatch(entries: GeoLiteAsnNetworkInput[]): Promise<number> {
		if (!entries.length) return 0;
		if (entries.length > IMPORT_BATCH_LIMIT)
			throw new Error("GeoLite ASN batches are limited to 5000 networks");
		const rows = entries.map((entry) => ({
			network: entry.network,
			...ipToRange(entry.network),
			asn: entry.asn,
			organization: entry.organization.trim(),
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
						asn: sql`excluded.asn`,
						organization: sql`excluded.organization`,
					}),
				)
				.execute();
		}
		return rows.length;
	}

	async clear(): Promise<void> {
		await this.store.db.deleteFrom(TABLE).execute();
	}

	async lookup(ip: string): Promise<GeoAsn | undefined> {
		const address = parseIpAddress(ip);
		if (!address) return undefined;
		return this.store.db
			.selectFrom(TABLE)
			.select(["asn", "organization"])
			.where("address_family", "=", address.family)
			.where("network_start", "<=", address.hex)
			.where("network_end", ">=", address.hex)
			.orderBy("prefix_length", "desc")
			.limit(1)
			.executeTakeFirst();
	}
}
