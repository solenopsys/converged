import { SqlMigration, type SqlStore } from "back-core";

/**
 * The machine's identity in the telemetry stream.
 *
 * Samples arrive carrying a free-form `device_id` and nothing said which
 * machine that was: the card guessed by serial number, which held only as
 * long as every adapter happened to be configured to send exactly that. This
 * column is the answer, stated once.
 */
export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_equipment_device", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .alterTable("equipment")
      .addColumn("deviceId", "text")
      .execute();

    // Unique rather than merely indexed: this key is what a telemetry row is
    // resolved through, and two machines answering one `device_id` would pour
    // their samples into one chart. Missing keys stay many — SQLite counts
    // NULLs as distinct — because a machine nothing reports for has none.
    await this.store.db.schema
      .createIndex("equipment_device_idx")
      .unique()
      .on("equipment")
      .column("deviceId")
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema
      .dropIndex("equipment_device_idx")
      .ifExists()
      .execute();
  }
}
