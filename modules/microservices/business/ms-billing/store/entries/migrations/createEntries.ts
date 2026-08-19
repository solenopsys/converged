import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_billing_entries", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("billing_entries")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("owner", "text", (col) => col.notNull())
      .addColumn("category", "text", (col) => col.notNull())
      .addColumn("amount", "real", (col) => col.notNull())
      .addColumn("currency", "text", (col) => col.defaultTo("USD").notNull())
      .addColumn("description", "text", (col) => col.defaultTo("").notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .dropTable("billing_entries")
      .ifExists()
      .execute();
  }
}
