import { SqlMigration, SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_user_module_configs", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("user_module_configs")
      .ifNotExists()
      .addColumn("userId", "text", (col) => col.primaryKey())
      .addColumn("presets", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("additions", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("removals", "text", (col) => col.notNull().defaultTo("[]"))
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("user_module_configs").ifExists().execute();
  }
}
