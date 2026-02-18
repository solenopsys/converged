import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_chart_rooms", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("chart_rooms")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("title", "text")
      .addColumn("type", "text", (col) => col.notNull())
      .addColumn("threadId", "text", (col) => col.notNull())
      .addColumn("createdBy", "text")
      .addColumn("archived", "integer", (col) => col.defaultTo(0).notNull())
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .addColumn("updatedAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();

    await this.store.db.schema
      .createIndex("idx_chart_rooms_thread")
      .ifNotExists()
      .on("chart_rooms")
      .column("threadId")
      .execute();

    await this.store.db.schema
      .createIndex("idx_chart_rooms_updated")
      .ifNotExists()
      .on("chart_rooms")
      .column("updatedAt")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("chart_rooms").ifExists().execute();
  }
}
