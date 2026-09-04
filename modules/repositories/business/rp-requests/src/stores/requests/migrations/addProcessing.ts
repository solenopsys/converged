import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_request_processing", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("request_processing")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("requestId", "text", (col) => col.notNull())
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("actor", "text", (col) => col.notNull())
      .addColumn("comment", "text", (col) => col.defaultTo("").notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .dropTable("request_processing")
      .ifExists()
      .execute();
  }
}
