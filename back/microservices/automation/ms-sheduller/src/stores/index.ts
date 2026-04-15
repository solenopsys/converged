import { StoreControllerAbstract, StoreType, JsonStore, SqlStore } from "back-core";
import { CronsStoreService } from "./crons";
import { HistoryStoreService } from "./history";
import historyMigrations from "./history-migrations";

export class StoresController extends StoreControllerAbstract {
  public crons!: CronsStoreService;
  public history!: HistoryStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const cronsStore = await this.addStore("crons", StoreType.JSON, []);
    this.crons = new CronsStoreService(cronsStore as JsonStore);

    const historyStore = await this.addStore("history", StoreType.SQL, historyMigrations);
    this.history = new HistoryStoreService(historyStore as SqlStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
