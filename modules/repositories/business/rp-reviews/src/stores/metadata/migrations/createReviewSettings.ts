import { SqlMigration, type SqlStore, sql } from "back-core";

/**
 * How this shop runs its funnel — one row, held as JSON.
 *
 * A column per knob would mean a migration every time a platform grows a
 * field, and the settings are read whole and written whole in any case. The
 * single-row table is the smallest thing that survives a restart.
 */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_review_settings", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("review_settings")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("value", "text", (col) => col.notNull())
			.addColumn("updatedAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
			)
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropTable("review_settings")
			.ifExists()
			.execute();
	}
}
