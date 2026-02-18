import { SqlMigration, SqlStore } from "back-core";

export default class CreateMessages extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_messages", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("messages")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("sessionId", "text", (col) => col.notNull())
      .addColumn("role", "text", (col) => col.notNull())
      .addColumn("content", "text", (col) => col.defaultTo(""))
      .addColumn("toolCalls", "text", (col) => col.defaultTo(""))
      .addColumn("toolCallId", "text", (col) => col.defaultTo(""))
      .addColumn("tokenUsage", "integer", (col) => col.defaultTo(0))
      .addColumn("createdAt", "integer", (col) => col.notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("messages").ifExists().execute();
  }
}
