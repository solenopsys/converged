import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_record_id_to_nodes", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .alterTable("nodes")
      .addColumn("record_id", "text")
      .execute();
  }

  async down(): Promise<void> {
    // SQLite не поддерживает DROP COLUMN в старых версиях — оставляем
  }
}
