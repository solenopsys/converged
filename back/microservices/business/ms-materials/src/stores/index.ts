import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { MaterialsStoreService } from "./materials/service";
import materialsMigrations from "./materials/migrations";

export class StoresController extends StoreControllerAbstract {
  public materials: MaterialsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const store = await this.addStore("materials", StoreType.SQL, materialsMigrations);
    this.materials = new MaterialsStoreService(store as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
