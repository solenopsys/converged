import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_transactions", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("transactions")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("type", "text", (col) => col.notNull())
      .addColumn("category", "text", (col) => col.notNull())
      .addColumn("amount", "real", (col) => col.notNull())
      .addColumn("currency", "text", (col) => col.defaultTo("RUB").notNull())
      .addColumn("description", "text")
      .addColumn("orderId", "text")
      .addColumn("counterparty", "text")
      .addColumn("dueAt", "text")
      .addColumn("paidAt", "text")
      .addColumn("isPaid", "integer", (col) => col.defaultTo(0).notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    await this.store.db.schema
      .createIndex("transactions_type_idx")
      .ifNotExists()
      .on("transactions")
      .column("type")
      .execute();

    await this.store.db.schema
      .createIndex("transactions_order_idx")
      .ifNotExists()
      .on("transactions")
      .column("orderId")
      .execute();

    await this.store.db.schema
      .createIndex("transactions_due_idx")
      .ifNotExists()
      .on("transactions")
      .column("dueAt")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("transactions").ifExists().execute();
  }
}
