import { SqlMigration, type SqlStore, type Store, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: Store) {
		super("add_analytics_geo_fields", store as SqlStore);
	}

	async up(): Promise<void> {
		const info = await sql<{
			name: string;
		}>`PRAGMA table_info(analytics_events)`.execute(this.store.db);
		const columns = new Set(info.rows.map((row) => row.name));
		const additions = [
			["ip_address", "text NOT NULL DEFAULT ''"],
			["country_code", "text NOT NULL DEFAULT ''"],
			["country_name", "text NOT NULL DEFAULT ''"],
			["region_name", "text NOT NULL DEFAULT ''"],
			["city_name", "text NOT NULL DEFAULT ''"],
			["asn", "integer NOT NULL DEFAULT 0"],
			["asn_organization", "text NOT NULL DEFAULT ''"],
		] as const;

		for (const [name, definition] of additions) {
			if (columns.has(name)) continue;
			await sql`ALTER TABLE analytics_events ADD COLUMN ${sql.raw(name)} ${sql.raw(definition)}`.execute(
				this.store.db,
			);
		}
		await this.store.db.schema
			.createIndex("analytics_events_ts_type_idx")
			.ifNotExists()
			.on("analytics_events")
			.columns(["ts", "event_type"])
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropIndex("analytics_events_ts_type_idx")
			.ifExists()
			.execute();
	}
}
