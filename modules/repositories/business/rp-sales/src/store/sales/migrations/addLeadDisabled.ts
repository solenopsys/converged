import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_lead_disabled", store);
	}

	async up(): Promise<void> {
		try {
			await this.store.db.schema
				.alterTable("leads")
				.addColumn("disabled", "boolean", (col) =>
					col.notNull().defaultTo(false),
				)
				.execute();
		} catch {
			// column already exists
		}
	}

	async down(): Promise<void> {}
}
