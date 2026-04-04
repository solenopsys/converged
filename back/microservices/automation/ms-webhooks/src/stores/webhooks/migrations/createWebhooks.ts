import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_webhooks", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("webhook_endpoints")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("provider", "text", (col) => col.notNull())
      .addColumn("params", "text")
      .addColumn("enabled", "integer", (col) => col.defaultTo(1).notNull())
      .addColumn("createdAt", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .addColumn("updatedAt", "text")
      .execute();

    await this.store.db.schema
      .createTable("webhook_logs")
      .ifNotExists()
      .addColumn("id", "integer", (col) => col.primaryKey())
      .addColumn("endpointId", "text", (col) => col.notNull())
      .addColumn("provider", "text", (col) => col.notNull())
      .addColumn("method", "text", (col) => col.notNull())
      .addColumn("path", "text", (col) => col.notNull())
      .addColumn("headers", "text")
      .addColumn("body", "text")
      .addColumn("ip", "text")
      .addColumn("status", "integer")
      .addColumn("error", "text")
      .addColumn("createdAt", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("webhook_logs").ifExists().execute();
    await this.store.db.schema.dropTable("webhook_endpoints").ifExists().execute();
  }
}
