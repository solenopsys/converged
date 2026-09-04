import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_touch", store);
	}

	async up(): Promise<void> {
		this.store.db.schema
			.createTable("touches")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("createdAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`),
			)
			.addColumn("contactId", "text", (col) => col.notNull())
			.addColumn("description", "text")
			.execute();
	}

	async down(): Promise<void> {
		this.store.db.schema.dropTable("touches").ifExists().execute();
	}
}
