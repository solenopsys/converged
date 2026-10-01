import { SqlMigration, type SqlStore, type Store, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: Store) {
		super("add_analytics_ip_session_device_fields", store as SqlStore);
	}

	async up(): Promise<void> {
		const info = await sql<{
			name: string;
		}>`PRAGMA table_info(analytics_ip_sessions)`.execute(this.store.db);
		const columns = new Set(info.rows.map((row) => row.name));
		for (const [name, definition] of [
			["device_type", "text NOT NULL DEFAULT 'unknown'"],
			["screen", "text NOT NULL DEFAULT ''"],
		] as const) {
			if (columns.has(name)) continue;
			await sql`ALTER TABLE analytics_ip_sessions ADD COLUMN ${sql.raw(name)} ${sql.raw(definition)}`.execute(
				this.store.db,
			);
		}
	}

	async down(): Promise<void> {}
}
