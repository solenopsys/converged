import { SqlStore, SqlMigration } from "back-core";

/**
 * Adds the auto-summary columns used by the dialogue-summary workflow:
 *   description — short generated summary of the conversation
 *   processed   — 0 until the workflow has produced a title/description
 *   flud        — 1 when the conversation is noise (no useful payload)
 */
export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_chart_rooms_summary", store);
  }

  async up(): Promise<void> {
    try {
      await this.store.db.schema
        .alterTable("chart_rooms")
        .addColumn("description", "text")
        .execute();
    } catch {
      // Column may already exist.
    }

    try {
      await this.store.db.schema
        .alterTable("chart_rooms")
        .addColumn("processed", "integer", (col) => col.defaultTo(0).notNull())
        .execute();
    } catch {
      // Column may already exist.
    }

    try {
      await this.store.db.schema
        .alterTable("chart_rooms")
        .addColumn("flud", "integer", (col) => col.defaultTo(0).notNull())
        .execute();
    } catch {
      // Column may already exist.
    }

    await this.store.db.schema
      .createIndex("idx_chart_rooms_processed")
      .ifNotExists()
      .on("chart_rooms")
      .column("processed")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .dropIndex("idx_chart_rooms_processed")
      .ifExists()
      .execute();
  }
}
