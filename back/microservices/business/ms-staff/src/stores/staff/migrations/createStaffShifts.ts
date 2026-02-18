import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_staff_shifts", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("staff_shifts")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("staffId", "text", (col) => col.notNull())
      .addColumn("workId", "text")
      .addColumn("startAt", "text", (col) => col.notNull())
      .addColumn("endAt", "text", (col) => col.notNull())
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
    await this.store.db.schema.dropTable("staff_shifts").ifExists().execute();
  }
}
