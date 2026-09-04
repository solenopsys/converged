import { ColumnMigration, ColumnStore } from "back-core";

export default class extends ColumnMigration {
  constructor(store: ColumnStore) {
    super("create_telemetry_events", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("telemetry_events")
      .ifNotExists()
      .addColumn("ts", "integer", (col) => col.notNull())
      .addColumn("device_id", "text", (col) => col.notNull())
      .addColumn("param", "text", (col) => col.notNull())
      .addColumn("value", "real", (col) => col.notNull())
      .addColumn("unit", "text", (col) => col.notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("telemetry_events").ifExists().execute();
  }
}
