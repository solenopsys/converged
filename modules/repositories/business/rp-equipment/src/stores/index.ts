import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { EquipmentStoreService } from "./equipment/service";
import { EquipmentLogsStoreService } from "./logs/service";
import { ScheduleStoreService } from "./schedule/service";
import equipmentMigrations from "./equipment/migrations";
import logsMigrations from "./logs/migrations";
import scheduleMigrations from "./schedule/migrations";

export class StoresController extends StoreControllerAbstract {
  public equipment: EquipmentStoreService;
  public logs: EquipmentLogsStoreService;
  public schedule: ScheduleStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const equipmentStore = await this.addStore("equipment", StoreType.SQL, equipmentMigrations);
    const logsStore = await this.addStore("equipment_logs", StoreType.SQL, logsMigrations);
    const scheduleStore = await this.addStore("schedule", StoreType.SQL, scheduleMigrations);

    this.equipment = new EquipmentStoreService(equipmentStore as SqlStore);
    // Logs and slots answer to the machine they hang on, which lives in another
    // store: they are handed its relation so a line is written with the tags
    // that machine carries.
    this.logs = new EquipmentLogsStoreService(
      logsStore as SqlStore,
      this.equipment.access,
    );
    this.schedule = new ScheduleStoreService(
      scheduleStore as SqlStore,
      this.equipment.access,
    );

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
