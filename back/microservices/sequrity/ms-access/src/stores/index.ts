import { StoreControllerAbstract, StoreType, KVStore, JsonStore } from "back-core";
import { AccessStoreService } from "./access/service";

export class StoresController extends StoreControllerAbstract {
  public access: AccessStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const accessStore = await this.addStore("access", StoreType.KVS, []);
    const presetsStore = await this.addStore("presets", StoreType.JSON, []);
    this.access = new AccessStoreService(
      accessStore as KVStore,
      presetsStore as JsonStore,
    );
    await this.startAll();
    await this.migrateAll();
    await this.access.migrateLegacyPresetsFromAccessStore();
  }

  async destroy() {
    await this.closeAll();
  }
}
