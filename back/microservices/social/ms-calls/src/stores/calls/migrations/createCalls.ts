import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_calls", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("calls")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("startedAt", "integer", (col) => col.notNull())
      .addColumn("phone", "text", (col) => col.notNull())
      .addColumn("threadId", "text")
      .addColumn("recordId", "text", (col) => col.notNull())
      .addColumn("dialogue", "text", (col) => col.defaultTo("[]").notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("calls").ifExists().execute();
  }
}
