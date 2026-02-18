import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_partners", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("partners")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("kind", "text", (col) => col.notNull())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("contact", "text")
      .addColumn("tags", "text", (col) => col.defaultTo("[]").notNull())
      .addColumn("note", "text")
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("partners").ifExists().execute();
  }
}
