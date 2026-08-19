import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_offers", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("offers")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("description", "text", (col) => col.notNull().defaultTo(""))
			.addColumn("template_path", "text", (col) => col.notNull().defaultTo(""))
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("offers").ifExists().execute();
	}
}
