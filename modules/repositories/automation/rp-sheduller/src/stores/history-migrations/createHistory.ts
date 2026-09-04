import { SqlMigration, SqlStore } from "back-core";

export default class CreateHistory extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_history", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("history")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("cronId", "text", (col) => col.notNull())
      .addColumn("cronName", "text", (col) => col.notNull())
      .addColumn("provider", "text", (col) => col.notNull())
      .addColumn("action", "text", (col) => col.notNull())
      .addColumn("firedAt", "text", (col) => col.notNull())
      .addColumn("success", "integer", (col) => col.notNull())
      .addColumn("message", "text")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("history").ifExists().execute();
  }
}
