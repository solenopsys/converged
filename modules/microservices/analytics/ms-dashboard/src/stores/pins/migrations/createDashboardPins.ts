import { SqlMigration, type SqlStore } from "back-core";

export default class CreateDashboardPins extends SqlMigration {
	constructor(store: SqlStore) {
		super("create_dashboard_pins", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.createTable("dashboard_indicator_pins")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("widgetId", "text", (col) => col.notNull().unique())
			.addColumn("title", "text")
			.addColumn("source", "text")
			.addColumn("componentKey", "text")
			.addColumn("position", "integer", (col) => col.notNull().defaultTo(0))
			.addColumn("createdAt", "text", (col) => col.notNull())
			.addColumn("updatedAt", "text", (col) => col.notNull())
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropTable("dashboard_indicator_pins")
			.ifExists()
			.execute();
	}
}
