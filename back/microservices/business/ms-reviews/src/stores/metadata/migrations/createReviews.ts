import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_reviews", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("reviews")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("author", "text", (col) => col.notNull())
      .addColumn("text", "text", (col) => col.notNull())
      .addColumn("rating", "integer", (col) => col.notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("reviews").ifExists().execute();
  }
}
