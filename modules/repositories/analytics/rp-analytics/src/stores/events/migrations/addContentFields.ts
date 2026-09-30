import { ColumnMigration, type ColumnStore, type Store, sql } from "back-core";

export default class extends ColumnMigration {
	constructor(store: Store) {
		super("add_analytics_content_fields", store as ColumnStore);
	}

	async up(): Promise<void> {
		const info = await sql<{
			name: string;
		}>`PRAGMA table_info(analytics_events)`.execute(this.store.db);
		const columns = new Set(info.rows.map((row) => row.name));
		const additions = [
			["audience_type", "text NOT NULL DEFAULT 'unknown'"],
			["content_type", "text NOT NULL DEFAULT ''"],
			["content_id", "text NOT NULL DEFAULT ''"],
		] as const;

		for (const [name, definition] of additions) {
			if (columns.has(name)) continue;
			await sql`ALTER TABLE analytics_events ADD COLUMN ${sql.raw(name)} ${sql.raw(definition)}`.execute(
				this.store.db,
			);
		}
	}

	async down(): Promise<void> {
		// Keep analytics dimensions when rolling application code back.
	}
}
