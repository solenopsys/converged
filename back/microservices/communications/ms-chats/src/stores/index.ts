import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import chartsMigrations from "./charts/migrations";
import { ChartsStoreService } from "./charts/service";

export class StoresController extends StoreControllerAbstract {
  public charts: ChartsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const chartsStore = await this.addStore("charts", StoreType.SQL, chartsMigrations);

    this.charts = new ChartsStoreService(chartsStore as SqlStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
