import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_notify_sends", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("notify_sends")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("templateId", "text", (col) => col.notNull())
      .addColumn("channel", "text", (col) => col.notNull())
      .addColumn("recipient", "text", (col) => col.notNull())
      .addColumn("params", "text", (col) => col.defaultTo("{}").notNull())
      .addColumn("status", "text", (col) => col.defaultTo("new").notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("notify_sends").ifExists().execute();
  }
}
