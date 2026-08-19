import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_requests", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("requests")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("source", "text")
      .addColumn("status", "text", (col) => col.defaultTo("new").notNull())
      .addColumn("fields", "text", (col) => col.defaultTo("{}").notNull())
      .addColumn("files", "text", (col) => col.defaultTo("{}").notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("requests").ifExists().execute();
  }
}
