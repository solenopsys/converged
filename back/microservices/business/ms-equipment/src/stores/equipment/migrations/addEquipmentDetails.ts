import { SqlMigration, type SqlStore } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_equipment_details", store);
  }

  async up(): Promise<void> {
    await this.store.db.schema
      .alterTable("equipment")
      .addColumn("serialNumber", "text")
      .execute();
    await this.store.db.schema
      .alterTable("equipment")
      .addColumn("location", "text")
      .execute();
    await this.store.db.schema
      .alterTable("equipment")
      .addColumn("description", "text")
      .execute();
    await this.store.db.schema
      .alterTable("equipment")
      .addColumn("maintenanceIntervalDays", "integer")
      .execute();
    await this.store.db.schema
      .alterTable("equipment")
      .addColumn("lastMaintenanceAt", "text")
      .execute();
  }

  async down(): Promise<void> {
    // SQLite не поддерживает DROP COLUMN в старых версиях — пропускаем
  }
}
