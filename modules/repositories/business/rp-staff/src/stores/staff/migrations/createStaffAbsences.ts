import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_staff_absences", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("staff_absences")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("staffId", "text", (col) => col.notNull())
      .addColumn("startAt", "text", (col) => col.notNull())
      .addColumn("endAt", "text", (col) => col.notNull())
      .addColumn("note", "text")
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("staff_absences").ifExists().execute();
  }
}
