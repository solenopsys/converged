import { SqlStore, SqlMigration, sql } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_video_segments", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("video_segments")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("streamId", "text", (col) => col.notNull())
      .addColumn("startTime", "integer", (col) => col.notNull())
      .addColumn("endTime", "integer", (col) => col.notNull())
      .addColumn("hash", "text", (col) => col.notNull())
      .addColumn("thumbPath", "text")
      .addColumn("createdAt", "text", (col) =>
        col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
      )
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("video_segments").ifExists().execute();
  }
}
