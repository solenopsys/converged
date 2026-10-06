import { SqlMigration, type SqlStore, type Store, sql } from "back-core";

const FIELDS = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
	"utm_term",
	"utm_content",
	"utm_id",
	"utm_source_platform",
	"utm_creative_format",
	"utm_marketing_tactic",
] as const;

export default class extends SqlMigration {
	constructor(store: Store) {
		super("add_analytics_ip_session_utm_fields", store as SqlStore);
	}

	async up(): Promise<void> {
		const info = await sql<{ name: string }>`PRAGMA table_info(analytics_ip_sessions)`.execute(this.store.db);
		const columns = new Set(info.rows.map((row) => row.name));
		for (const name of FIELDS) {
			if (columns.has(name)) continue;
			await sql`ALTER TABLE analytics_ip_sessions ADD COLUMN ${sql.raw(name)} text NOT NULL DEFAULT ''`.execute(this.store.db);
		}
	}

	async down(): Promise<void> {}
}
