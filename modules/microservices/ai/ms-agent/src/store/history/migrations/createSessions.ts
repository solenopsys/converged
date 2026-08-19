import { SqlMigration, SqlStore } from "back-core";

export default class CreateSessions extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_sessions", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("sessions")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("model", "text", (col) => col.notNull())
      .addColumn("createdAt", "integer", (col) => col.notNull())
      .addColumn("updatedAt", "integer", (col) => col.notNull())
      .addColumn("messageCount", "integer", (col) => col.defaultTo(0))
      .addColumn("totalTokensInput", "integer", (col) => col.defaultTo(0))
      .addColumn("totalTokensOutput", "integer", (col) => col.defaultTo(0))
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("sessions").ifExists().execute();
  }
}
