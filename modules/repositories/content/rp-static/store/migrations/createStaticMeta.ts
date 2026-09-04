import { SqlMigration, SqlStore } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_static_meta", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("static_meta")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey().notNull())
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("contentType", "text", (col) => col.notNull())
      .addColumn("size", "integer", (col) => col.notNull())
      .addColumn("loadedAt", "integer")
      .addColumn("updatedAt", "integer", (col) => col.notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("static_meta").ifExists().execute();
  }
}
