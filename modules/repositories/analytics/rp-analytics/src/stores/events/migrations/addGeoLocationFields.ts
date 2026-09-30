import { ColumnMigration, type ColumnStore, type Store, sql } from "back-core";

export default class extends ColumnMigration {
	constructor(store: Store) {
		super("add_analytics_geo_location_fields", store as ColumnStore);
	}

	async up(): Promise<void> {
		const info = await sql<{
			name: string;
		}>`PRAGMA table_info(analytics_events)`.execute(this.store.db);
		const columns = new Set(info.rows.map((row) => row.name));
		for (const name of ["region_name", "city_name"]) {
			if (columns.has(name)) continue;
			await sql`ALTER TABLE analytics_events ADD COLUMN ${sql.raw(name)} text NOT NULL DEFAULT ''`.execute(
				this.store.db,
			);
		}
	}

	async down(): Promise<void> {}
}
