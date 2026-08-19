import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_equipment", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("equipment")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("kind", "text", (col) => col.notNull())
      .addColumn("name", "text", (col) => col.defaultTo("").notNull())
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("jobId", "text")
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("equipment").ifExists().execute();
  }
}
