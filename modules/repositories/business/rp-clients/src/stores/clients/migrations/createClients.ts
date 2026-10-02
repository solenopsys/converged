import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_clients", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("clients")
			.ifNotExists()
			.addColumn("id", "text", (column) => column.primaryKey())
			.addColumn("name", "text", (column) => column.notNull())
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("clients").ifExists().execute();
	}
}
