import { SqlMigration, type SqlStore, type Store, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: Store) {
		super("add_analytics_ip_session_event_count", store as SqlStore);
	}

	async up(): Promise<void> {
		const info = await sql<{ name: string }>`PRAGMA table_info(analytics_ip_sessions)`.execute(this.store.db);
		if (info.rows.some((row) => row.name === "event_count")) return;
		await sql`ALTER TABLE analytics_ip_sessions ADD COLUMN event_count integer NOT NULL DEFAULT 0`.execute(this.store.db);
	}

	async down(): Promise<void> {}
}
