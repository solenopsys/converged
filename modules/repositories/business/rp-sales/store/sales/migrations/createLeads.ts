import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_leads", store);
	}

	async up(): Promise<void> {
		this.store.db.schema
			.createTable("leads")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("createdAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.addColumn("description", "text")
			.addColumn("lang", "text", (col) => col.defaultTo(""))
			.addColumn("type", "text", (col) => col.defaultTo(""))
			.addColumn("catalogId", "text", (col) => col.defaultTo(""))
			.addColumn("disabled", "boolean", (col) =>
				col.notNull().defaultTo(false),
			)
			.execute();
	}

	async down(): Promise<void> {
		this.store.db.schema.dropTable("leads").ifExists().execute();
	}
}
