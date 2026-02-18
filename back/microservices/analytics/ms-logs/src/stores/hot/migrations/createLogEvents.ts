import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_log_events", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("log_events")
      .ifNotExists()
      .addColumn("ts", "integer", (col) => col.notNull())
      .addColumn("source", "text", (col) => col.notNull())
      .addColumn("level", "integer", (col) => col.notNull())
      .addColumn("code", "integer", (col) => col.notNull())
      .addColumn("message", "text", (col) => col.notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("log_events").ifExists().execute();
  }
}
