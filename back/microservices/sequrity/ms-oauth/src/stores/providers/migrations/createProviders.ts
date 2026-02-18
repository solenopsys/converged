import { SqlMigration, SqlStore } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_oauth_providers", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("oauth_providers")
      .ifNotExists()
      .addColumn("provider", "text", (col) => col.primaryKey())
      .addColumn("clientId", "text", (col) => col.notNull())
      .addColumn("clientSecret", "text", (col) => col.notNull())
      .addColumn("authorizeUrl", "text", (col) => col.notNull())
      .addColumn("tokenUrl", "text", (col) => col.notNull())
      .addColumn("userinfoUrl", "text", (col) => col.notNull())
      .addColumn("scopes", "text", (col) => col.notNull())
      .addColumn("enabled", "integer", (col) => col.defaultTo(0))
      .addColumn("createdAt", "integer", (col) => col.defaultTo(0))
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("oauth_providers").ifExists().execute();
  }
}
