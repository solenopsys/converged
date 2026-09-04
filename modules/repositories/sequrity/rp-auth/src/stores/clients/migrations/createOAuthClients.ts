import { SqlMigration, SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_oauth_clients", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("oauth_clients")
      .ifNotExists()
      .addColumn("clientId", "text", (col) => col.primaryKey())
      .addColumn("clientSecret", "text", (col) => col.notNull())
      .addColumn("redirectUris", "text", (col) => col.notNull())
      .addColumn("grantTypes", "text", (col) => col.notNull())
      .addColumn("trusted", "integer", (col) => col.defaultTo(0))
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("oauth_clients").ifExists().execute();
  }
}
