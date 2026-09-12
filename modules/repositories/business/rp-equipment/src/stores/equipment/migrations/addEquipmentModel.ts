import { SqlMigration, type SqlStore } from "back-core";

/**
 * The machine's link to the classifier.
 *
 * Reference data — build volume, materials, the adapter that speaks to it —
 * is not copied onto the record: the operator names the model and the rest is
 * read from `rp-classifier` when it is needed. This column is that name.
 */
export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_equipment_model", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .alterTable("equipment")
      .addColumn("classifierNodeId", "text")
      .execute();
  }

  async down(): Promise<void> {
  }
}
