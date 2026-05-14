import { SqlMigration, type SqlStore, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_schedule_slots", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("schedule_slots")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("equipmentId", "text", (col) => col.notNull())
      .addColumn("jobId", "text")
      .addColumn("orderId", "text")
      .addColumn("startAt", "text", (col) => col.notNull())
      .addColumn("endAt", "text", (col) => col.notNull())
      .addColumn("status", "text", (col) => col.defaultTo("planned").notNull())
      .addColumn("note", "text")
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    await this.store.db.schema
      .createIndex("schedule_slots_equipment_idx")
      .ifNotExists()
      .on("schedule_slots")
      .column("equipmentId")
      .execute();

    await this.store.db.schema
      .createIndex("schedule_slots_start_idx")
      .ifNotExists()
      .on("schedule_slots")
      .column("startAt")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("schedule_slots").ifExists().execute();
  }
}
