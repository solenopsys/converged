import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_materials", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("materials")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("sku", "text")
      .addColumn("category", "text", (col) => col.notNull())
      .addColumn("unit", "text", (col) => col.notNull())
      .addColumn("description", "text")
      .addColumn("stockQuantity", "real", (col) => col.defaultTo(0).notNull())
      .addColumn("minStockQuantity", "real", (col) => col.defaultTo(0).notNull())
      .addColumn("reservedQuantity", "real", (col) => col.defaultTo(0).notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    await this.store.db.schema
      .createIndex("materials_category_idx")
      .ifNotExists()
      .on("materials")
      .column("category")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("materials").ifExists().execute();
  }
}
