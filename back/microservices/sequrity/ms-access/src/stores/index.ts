import { StoreControllerAbstract, StoreType, KVStore } from "back-core";
import { AccessStoreService } from "./access/service";

export class StoresController extends StoreControllerAbstract {
  public access: AccessStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const accessStore = await this.addStore("access", StoreType.KVS, []);
    this.access = new AccessStoreService(accessStore as KVStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
