import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("add_lead_fields", store);
	}

	async up(): Promise<void> {
		for (const col of ["lang", "type", "catalogId"] as const) {
			try {
				await this.store.db.schema
					.alterTable("leads")
					.addColumn(col, "text", (c) => c.defaultTo(""))
					.execute();
			} catch {
				// column already exists
			}
		}
	}

	async down(): Promise<void> {}
}
