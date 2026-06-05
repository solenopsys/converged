import { SqlMigration, SqlStore } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_audio_fragments", store);
  }

  async up(): Promise<void> {
    try {
      await this.store.db.schema
        .alterTable("calls")
        .addColumn("audioId", "text")
        .execute();
    } catch {
      // Column may already exist in stores created by the updated create_calls migration.
    }

    await this.store.db.schema
      .createTable("call_fragments")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("callId", "text", (col) => col.notNull())
      .addColumn("audioId", "text", (col) => col.notNull())
      .addColumn("source", "text", (col) => col.notNull())
      .addColumn("timestampNs", "integer", (col) => col.notNull())
      .addColumn("durationMs", "integer")
      .addColumn("sizeBytes", "integer", (col) => col.notNull())
      .addColumn("kvsKey", "text", (col) => col.notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropTable("call_fragments").ifExists().execute();
  }
}
