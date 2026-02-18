import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_usage", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("usage_events")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("func", "text", (col) => col.notNull())
      .addColumn("user", "text", (col) => col.notNull())
      .addColumn("date", "text", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("usage_events").ifExists().execute();
  }
}
