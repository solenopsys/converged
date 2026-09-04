import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_process", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("process")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("workflow_id", "text")
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("started_at", "integer")
      .addColumn("updated_at", "integer")
      .addColumn("created_at", "integer")
      .addColumn("meta", "text")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("process").ifExists().execute();
  }
}
