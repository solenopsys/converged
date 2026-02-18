import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_deliveries", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("deliveries")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("orderId", "text", (col) => col.notNull())
      .addColumn("customerId", "text", (col) => col.notNull())
      .addColumn("providerId", "text")
      .addColumn("status", "text", (col) => col.notNull())
      .addColumn("tracking", "text")
      .addColumn("shipment", "text", (col) => col.defaultTo("{}").notNull())
      .addColumn("shipDate", "text")
      .addColumn("deliveredAt", "text")
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
    await this.store.db.schema.dropTable("deliveries").ifExists().execute();
  }
}
