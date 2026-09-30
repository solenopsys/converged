import { type SqlStore, sql } from "back-core";
import type { GeoLiteAsnNetworkInput } from "../../../types";
import { ipToRange, parseIpAddress } from "../network";

const TABLE = "geolite_asn_networks";
const IMPORT_BATCH_LIMIT = 1_000;

export type GeoAsn = { network: string; asn: number; organization: string };

export class GeoAsnStoreService {
	constructor(private readonly store: SqlStore) {}

	async importBatch(
		importId: string,
		entries: GeoLiteAsnNetworkInput[],
	): Promise<number> {
		if (!entries.length) return 0;
		if (entries.length > IMPORT_BATCH_LIMIT)
			throw new Error("GeoLite ASN batches are limited to 1000 networks");
		const updatedAt = Date.now();
		const rows = entries.map((entry) => ({
			network: entry.network,
			...ipToRange(entry.network),
			asn: entry.asn,
			organization: entry.organization.trim(),
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
					asn: sql`excluded.asn`,
					organization: sql`excluded.organization`,
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

	async lookup(ip: string): Promise<GeoAsn | undefined> {
		const address = parseIpAddress(ip);
		if (!address) return undefined;
		return this.store.db
			.selectFrom(TABLE)
			.select(["network", "asn", "organization"])
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
				.selectFrom(TABLE)
				.select(["network", "asn", "organization"])
				.orderBy("network", "asc")
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
