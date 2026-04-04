import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_nodes", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("nodes")
      .ifNotExists()
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("process_id", "text", (col) => col.notNull())
      .addColumn("node_id", "text", (col) => col.notNull())
      .addColumn("state", "text", (col) => col.notNull())
      .addColumn("started_at", "integer")
      .addColumn("completed_at", "integer")
      .addColumn("error_message", "text")
      .addColumn("retry_count", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("created_at", "integer")
      .addColumn("updated_at", "integer")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("nodes").ifExists().execute();
  }
}
