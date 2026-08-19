import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_contact_description", store);
	}

	async up(): Promise<void> {
		try {
			await this.store.db.schema
				.alterTable("contacts")
				.addColumn("description", "text", (c) => c.defaultTo(""))
				.execute();
		} catch {
			// column already exists
		}
	}

	async down(): Promise<void> {}
}
