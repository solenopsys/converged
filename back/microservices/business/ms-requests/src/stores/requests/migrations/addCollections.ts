import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_request_collections", store);
	}

	async up(): Promise<void> {
		const info = await sql<{ name: string }>`PRAGMA table_info(requests)`.execute(
			this.store.db,
		);
		const columns = new Set(info.rows.map((row) => row.name));
		if (!columns.has("collections")) {
			await sql`ALTER TABLE requests ADD COLUMN collections text DEFAULT '{}' NOT NULL`.execute(
				this.store.db,
			);
		}
	}

	async down(): Promise<void> {
		// SQLite cannot drop columns without rebuilding the table.
	}
}
