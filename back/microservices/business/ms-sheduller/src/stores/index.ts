import { StoreControllerAbstract, StoreType, KVStore } from "back-core";
import { CronsStoreService } from "./crons";
import { HistoryStoreService } from "./history";

export class StoresController extends StoreControllerAbstract {
  public crons!: CronsStoreService;
  public history!: HistoryStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const cronsStore = await this.addStore("crons", StoreType.KVS, []);
    this.crons = new CronsStoreService(cronsStore as KVStore);

    const historyStore = await this.addStore("history", StoreType.KVS, []);
    this.history = new HistoryStoreService(historyStore as KVStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
