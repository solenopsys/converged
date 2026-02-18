import { ColumnMigration, ColumnStore } from "back-core";

const TELEMETRY_TABLE_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS telemetry_events
USING stanchion (
  ts INTEGER NOT NULL,
  device_id TEXT NOT NULL,
  param TEXT NOT NULL,
  value FLOAT NOT NULL,
  unit TEXT NOT NULL,
  SORT KEY (device_id, ts)
);
`;

export default class extends ColumnMigration {
  constructor(store: ColumnStore) {
    super("create_telemetry_events", store);
  }

  async up(): Promise<void> {
    this.store.raw.exec(TELEMETRY_TABLE_DDL);
  }

  async down(): Promise<void> {
    this.store.raw.exec("DROP TABLE IF EXISTS telemetry_events;");
  }
}
