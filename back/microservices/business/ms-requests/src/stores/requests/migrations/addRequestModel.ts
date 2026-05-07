import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_request_model", store);
	}

	async up(): Promise<void> {
		const info = await sql<{ name: string }>`PRAGMA table_info(requests)`.execute(
			this.store.db,
		);
		const columns = new Set(info.rows.map((row) => row.name));

		if (!columns.has("model")) {
			await sql`ALTER TABLE requests ADD COLUMN model text DEFAULT '{}' NOT NULL`.execute(
				this.store.db,
			);
		}
		if (!columns.has("updatedAt")) {
			await sql`ALTER TABLE requests ADD COLUMN updatedAt text DEFAULT CURRENT_TIMESTAMP NOT NULL`.execute(
				this.store.db,
			);
		}
	}

	async down(): Promise<void> {
		// SQLite cannot drop columns in a small reversible migration without
		// rebuilding the table. Keeping the data is safer for local stores.
	}
}
