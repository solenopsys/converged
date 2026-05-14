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
    this.logs = new EquipmentLogsStoreService(logsStore as SqlStore);
    this.schedule = new ScheduleStoreService(scheduleStore as SqlStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
