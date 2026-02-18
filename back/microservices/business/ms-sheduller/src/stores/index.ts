import { StoreControllerAbstract, StoreType, KVStore } from "back-core";
import { CronsStoreService } from "./crons";

export class StoresController extends StoreControllerAbstract {
  public crons!: CronsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const cronsStore = await this.addStore("crons", StoreType.KVS, []);
    this.crons = new CronsStoreService(cronsStore as KVStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
