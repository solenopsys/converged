import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_chunks", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("chunk_metadata")
      .ifNotExists()
      .addColumn("hash", "text", (col) => col.primaryKey())
      .addColumn("size", "integer", (col) => col.notNull())
      .addColumn("originalSize", "integer", (col) => col.notNull())
      .addColumn("compression", "text", (col) =>
        col.defaultTo("deflate").notNull(),
      )
      .addColumn("refCount", "integer", (col) => col.defaultTo(1).notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("chunk_metadata").ifExists().execute();
  }
}
