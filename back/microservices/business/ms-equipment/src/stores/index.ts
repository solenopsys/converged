import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { EquipmentStoreService } from "./equipment/service";
import equipmentMigrations from "./equipment/migrations";

export class StoresController extends StoreControllerAbstract {
  public equipment: EquipmentStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const equipmentStore = await this.addStore(
      "equipment",
      StoreType.SQL,
      equipmentMigrations,
    );
    this.equipment = new EquipmentStoreService(equipmentStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
