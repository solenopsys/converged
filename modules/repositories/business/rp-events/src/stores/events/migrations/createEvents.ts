import { SqlMigration, type SqlStore } from "back-core";

export default class CreateEvents extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_events", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("events")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("createdAt", "text", (col) => col.notNull())
			.addColumn("type", "text", (col) => col.notNull())
			.addColumn("service", "text", (col) => col.notNull())
			.addColumn("entityId", "text", (col) => col.notNull())
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("events").ifExists().execute();
	}
}
