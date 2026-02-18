import { ColumnMigration, ColumnStore } from "back-core";

const LOG_TABLE_DDL = `
CREATE VIRTUAL TABLE IF NOT EXISTS log_events
USING stanchion (
  ts INTEGER NOT NULL,
  source TEXT NOT NULL,
  level INTEGER NOT NULL,
  code INTEGER NOT NULL,
  message TEXT NOT NULL,
  SORT KEY (ts, source)
);
`;

export default class extends ColumnMigration {
  constructor(store: ColumnStore) {
    super("create_log_events", store);
  }

  async up(): Promise<void> {
    this.store.raw.exec(LOG_TABLE_DDL);
  }

  async down(): Promise<void> {
    this.store.raw.exec("DROP TABLE IF EXISTS log_events;");
  }
}
