import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_galery_images", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("galery_images")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("galeryId", "text", (col) => col.notNull())
      .addColumn("title", "text")
      .addColumn("description", "text")
      .addColumn("originalName", "text")
      .addColumn("mimeType", "text")
      .addColumn("filePath", "text", (col) => col.notNull())
      .addColumn("thumbPath", "text", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("galery_images").ifExists().execute();
  }
}
