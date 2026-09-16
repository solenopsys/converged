import { SqlMigration, type SqlStore } from "back-core";

/**
 * Pins of every tabbed place besides the surface strip — the home screen and
 * the bar inside each surface. One column holding a list, like the others: it
 * is read with the rest of the environment and written one place at a time.
 */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_scoped_layouts", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("user_environment")
			.addColumn("layouts", "text", (col) => col.notNull().defaultTo("[]"))
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.alterTable("user_environment")
			.dropColumn("layouts")
			.execute();
	}
}
