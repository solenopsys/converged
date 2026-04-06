import { SqlMigration, SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_users", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("users")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("email", "text", (col) => col.notNull())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("picture", "text")
      .addColumn("emailVerified", "integer", (col) => col.defaultTo(0))
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("users").ifExists().execute();
  }
}
