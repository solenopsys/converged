import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_movements", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("stock_movements")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("materialId", "text", (col) => col.notNull())
      .addColumn("type", "text", (col) => col.notNull())
      .addColumn("quantity", "real", (col) => col.notNull())
      .addColumn("reason", "text")
      .addColumn("orderId", "text")
      .addColumn("equipmentId", "text")
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    await this.store.db.schema
      .createIndex("movements_material_idx")
      .ifNotExists()
      .on("stock_movements")
      .column("materialId")
      .execute();

    await this.store.db.schema
      .createIndex("movements_order_idx")
      .ifNotExists()
      .on("stock_movements")
      .column("orderId")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("stock_movements").ifExists().execute();
  }
}
