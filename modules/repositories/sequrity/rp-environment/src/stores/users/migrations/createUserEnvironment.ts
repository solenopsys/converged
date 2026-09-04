import { SqlMigration, SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_user_environment", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("user_environment")
      .ifNotExists()
      .addColumn("userId", "text", (col) => col.primaryKey())
      .addColumn("windows", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn(
        "commandLayout",
        "text",
        (col) => col.notNull().defaultTo('{"pinned":[],"hidden":[],"order":[]}'),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("user_environment").ifExists().execute();
  }
}
