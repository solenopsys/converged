import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_equipment_logs", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("equipment_logs")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("equipmentId", "text", (col) => col.notNull())
      .addColumn("eventType", "text", (col) => col.notNull())
      .addColumn("severity", "text", (col) => col.defaultTo("info").notNull())
      .addColumn("description", "text", (col) => col.notNull())
      .addColumn("jobId", "text")
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    await this.store.db.schema
      .createIndex("equipment_logs_equipment_idx")
      .ifNotExists()
      .on("equipment_logs")
      .column("equipmentId")
      .execute();

    await this.store.db.schema
      .createIndex("equipment_logs_created_idx")
      .ifNotExists()
      .on("equipment_logs")
      .column("createdAt")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("equipment_logs").ifExists().execute();
  }
}
