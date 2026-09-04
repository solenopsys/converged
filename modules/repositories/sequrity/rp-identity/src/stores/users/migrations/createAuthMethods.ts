import { SqlMigration, SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_auth_methods", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("auth_methods")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("userId", "text", (col) => col.notNull())
      .addColumn("provider", "text", (col) => col.notNull())
      .addColumn("providerUserId", "text", (col) => col.notNull())
      .addColumn("email", "text", (col) => col.notNull())
      .addColumn("lastUsedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("auth_methods").ifExists().execute();
  }
}
