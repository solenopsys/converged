import { SqlMigration, type SqlStore, sql } from "back-core";

/**
 * Drops the global uniqueness of `widgetId`.
 *
 * A dashboard belongs to a person, so the same indicator is pinned by as many
 * people as care about it. The unique index said otherwise — it made a widget
 * id the identity of a pin across the whole installation, which is why one
 * person's pin appeared on everybody's screen and either of them could take it
 * off. Uniqueness now lives where it belongs: one pin per widget *per audience*,
 * enforced by the access tags when a pin is written.
 *
 * SQLite cannot drop a column constraint in place, so the table is rebuilt. The
 * rows are copied with their ids, which is what the tag relation points at.
 */
export default class PerUserWidgetIds extends SqlMigration {
	constructor(store: SqlStore) {
		super("dashboard_pins_per_user_widget_ids", store);
	}

	async up(): Promise<void> {
		await this.store.db.schema
			.alterTable("dashboard_indicator_pins")
			.renameTo("dashboard_indicator_pins_legacy")
			.execute();

		await this.store.db.schema
			.createTable("dashboard_indicator_pins")
			.ifNotExists()
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("widgetId", "text", (col) => col.notNull())
			.addColumn("title", "text")
			.addColumn("source", "text")
			.addColumn("componentKey", "text")
			.addColumn("position", "integer", (col) => col.notNull().defaultTo(0))
			.addColumn("createdAt", "text", (col) => col.notNull())
			.addColumn("updatedAt", "text", (col) => col.notNull())
			.execute();

		await this.store.db.schema
			.createIndex("idx_dashboard_pins_widget")
			.ifNotExists()
			.on("dashboard_indicator_pins")
			.column("widgetId")
			.execute();

		await sql`
      insert into dashboard_indicator_pins
        (id, widgetId, title, source, componentKey, position, createdAt, updatedAt)
      select id, widgetId, title, source, componentKey, position, createdAt, updatedAt
      from dashboard_indicator_pins_legacy
    `.execute(this.store.db);

		await this.store.db.schema
			.dropTable("dashboard_indicator_pins_legacy")
			.ifExists()
			.execute();
	}

	async down(): Promise<void> {
		await this.store.db.schema
			.dropIndex("idx_dashboard_pins_widget")
			.ifExists()
			.execute();
	}
}
