import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_owner", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .alterTable("chunk_metadata")
      .addColumn("owner", "text", (col) => col.defaultTo("").notNull())
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .alterTable("chunk_metadata")
      .dropColumn("owner")
      .execute();
  }
}
