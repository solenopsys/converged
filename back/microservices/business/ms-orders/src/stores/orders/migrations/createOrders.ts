import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_orders", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("orders")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("requestId", "text")
			.addColumn("modelName", "text", (col) => col.notNull())
			.addColumn("productionMethod", "text", (col) => col.notNull())
			.addColumn("status", "text", (col) => col.defaultTo("queued").notNull())
			.addColumn("quantity", "integer", (col) => col.defaultTo(1).notNull())
			.addColumn("weightGrams", "real")
			.addColumn("material", "text")
			.addColumn("equipmentId", "text")
			.addColumn("dueAt", "text")
			.addColumn("notes", "text")
			.addColumn("createdAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
			)
			.addColumn("updatedAt", "text", (col) =>
				col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
			)
			.execute();

		await this.store.db.schema
			.createIndex("orders_request_idx")
			.ifNotExists()
			.on("orders")
			.column("requestId")
			.execute();
		await this.store.db.schema
			.createIndex("orders_status_idx")
			.ifNotExists()
			.on("orders")
			.column("status")
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema.dropTable("orders").ifExists().execute();
	}
}
