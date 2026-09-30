import { SqlMigration, type SqlStore, type Store, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: Store) {
		super("add_geolite_asn_import_fields", store as SqlStore);
	}

	async up(): Promise<void> {
		const info = await sql<{
			name: string;
		}>`PRAGMA table_info(geolite_asn_networks)`.execute(this.store.db);
		const columns = new Set(info.rows.map((row) => row.name));
		for (const [name, definition] of [
			["import_id", "text NOT NULL DEFAULT ''"],
			["updated_at", "integer NOT NULL DEFAULT 0"],
		] as const) {
			if (columns.has(name)) continue;
			await sql`ALTER TABLE geolite_asn_networks ADD COLUMN ${sql.raw(name)} ${sql.raw(definition)}`.execute(
				this.store.db,
			);
		}
	}

	async down(): Promise<void> {}
}
