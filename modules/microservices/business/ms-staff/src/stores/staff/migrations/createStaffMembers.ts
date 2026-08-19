import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_staff_members", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("staff_members")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("userId", "text")
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("contact", "text")
      .addColumn("role", "text")
      .addColumn("active", "integer", (col) => col.defaultTo(1).notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("staff_members").ifExists().execute();
  }
}
