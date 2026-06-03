import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_contacts", store);
	}

	async up(): Promise<void> {
		this.store.db.schema
			.createTable("contacts")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("leadId", "text", (col) => col.notNull())
			.addColumn("createdAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.addColumn("contactType", "text")
			.addColumn("value", "text", (col) => col.defaultTo(""))
			.addColumn("role", "text", (col) => col.defaultTo(""))
			.addColumn("description", "text", (col) => col.defaultTo(""))
			.execute();
	}

	async down(): Promise<void> {
		this.store.db.schema.dropTable("contacts").ifExists().execute();
	}
}
