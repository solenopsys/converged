import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_contact_value", store);
	}

	async up(): Promise<void> {
		try {
			await this.store.db.schema
				.alterTable("contacts")
				.addColumn("value", "text", (col) => col.defaultTo(""))
				.execute();
		} catch {
			// column already exists
		}
	}

	async down(): Promise<void> {}
}
