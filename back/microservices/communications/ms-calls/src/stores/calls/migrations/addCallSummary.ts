import { SqlMigration, SqlStore } from "back-core";

/**
 * Adds the auto-summary columns used by the dialogue-summary workflow:
 *   title       — human-readable call title
 *   description — short generated summary of the call
 *   processed   — 0 until the workflow has produced a title/description
 *   flud        — 1 when the call is noise (no useful payload)
 */
export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_calls_summary", store);
  }

  async up(): Promise<void> {
    for (const column of ["title", "description"] as const) {
      try {
        await this.store.db.schema
          .alterTable("calls")
          .addColumn(column, "text")
          .execute();
      } catch {
        // Column may already exist.
      }
    }

    try {
      await this.store.db.schema
        .alterTable("calls")
        .addColumn("processed", "integer", (col) => col.defaultTo(0).notNull())
        .execute();
    } catch {
      // Column may already exist.
    }

    try {
      await this.store.db.schema
        .alterTable("calls")
        .addColumn("flud", "integer", (col) => col.defaultTo(0).notNull())
        .execute();
    } catch {
      // Column may already exist.
    }

    await this.store.db.schema
      .createIndex("idx_calls_processed")
      .ifNotExists()
      .on("calls")
      .column("processed")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .dropIndex("idx_calls_processed")
      .ifExists()
      .execute();
  }
}
