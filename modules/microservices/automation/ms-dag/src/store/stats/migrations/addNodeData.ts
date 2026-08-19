import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_data_result_to_nodes", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .alterTable("nodes")
      .addColumn("data", "text")
      .execute();
    await this.store.db.schema
      .alterTable("nodes")
      .addColumn("result", "text")
      .execute();
  }

  async down(): Promise<void> {}
}
