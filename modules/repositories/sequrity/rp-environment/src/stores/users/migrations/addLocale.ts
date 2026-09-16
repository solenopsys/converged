import { SqlMigration, type SqlStore } from "back-core";

/** The interface language a user chose; empty until they choose one. */
export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_locale", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("user_environment")
			.addColumn("locale", "text", (col) => col.notNull().defaultTo(""))
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.alterTable("user_environment")
			.dropColumn("locale")
			.execute();
	}
}
