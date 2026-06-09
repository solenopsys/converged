import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_thread_index", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("thread_index")
      .ifNotExists()
      .addColumn("threadId", "text", (col) => col.primaryKey())
      .addColumn("kind", "text", (col) => col.notNull().defaultTo("chat"))
      .addColumn("messageCount", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("createdAt", "integer", (col) => col.notNull())
      .addColumn("updatedAt", "integer", (col) => col.notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("thread_index").ifExists().execute();
  }
}
