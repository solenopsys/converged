import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("create_calls", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .createTable("calls")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("startedAt", "integer", (col) => col.notNull())
      .addColumn("phone", "text", (col) => col.notNull())
      .addColumn("threadId", "text")
      .addColumn("recordId", "text", (col) => col.notNull())
      .addColumn("audioId", "text")
      .addColumn("dialogue", "text", (col) => col.defaultTo("[]").notNull())
      .execute();

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
    await this.store.db.schema.dropTable("calls").ifExists().execute();
  }
}
