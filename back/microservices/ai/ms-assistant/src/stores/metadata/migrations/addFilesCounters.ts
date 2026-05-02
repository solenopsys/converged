import { SqlMigration, SqlStore } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_files_counters", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .alterTable("conversations")
      .addColumn("filesCount", "integer", (col) => col.defaultTo(0))
      .execute();

    await this.store.db.schema
      .alterTable("conversations")
      .addColumn("filesSize", "integer", (col) => col.defaultTo(0))
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .alterTable("conversations")
      .dropColumn("filesSize")
      .execute();

    await this.store.db.schema
      .alterTable("conversations")
      .dropColumn("filesCount")
      .execute();
  }
}
