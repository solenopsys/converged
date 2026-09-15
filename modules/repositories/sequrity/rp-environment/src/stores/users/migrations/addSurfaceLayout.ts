import { SqlMigration, type SqlStore } from "back-core";

/**
 * Pinned surfaces per user. A column beside `commandLayout` rather than a
 * table: it is read and written whole, with the rest of the environment.
 */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_surface_layout", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("user_environment")
			.addColumn("surfaceLayout", "text", (col) =>
				col.notNull().defaultTo('{"pinned":[],"unpinned":[]}'),
			)
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.alterTable("user_environment")
			.dropColumn("surfaceLayout")
			.execute();
	}
}
