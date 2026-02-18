import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_delivery_status_log", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("delivery_status_log")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("deliveryId", "text", (col) => col.notNull())
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("sourceType", "text", (col) => col.notNull())
      .addColumn("sourceId", "text")
      .addColumn("note", "text")
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .dropTable("delivery_status_log")
      .ifExists()
      .execute();
  }
}
