import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_nodes", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("nodes")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey().notNull())
      .addColumn("parentId", "text")
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("slug", "text", (col) => col.notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("nodes").ifExists().execute();
  }
}
