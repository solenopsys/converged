import { StoreControllerAbstract, StoreType, KVStore, SqlStore } from "back-core";
import { ProcessingStoreService } from "./processing";
import { StatsStoreService } from "./stats";
import statsMigrations from "./stats/migrations";

export class StoresController extends StoreControllerAbstract {
  public processingStoreService!: ProcessingStoreService;
  public statsStoreService!: StatsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const processingStore = await this.addStore("processing", StoreType.KVS, []);
    this.processingStoreService = new ProcessingStoreService(
      processingStore as KVStore,
    );

    const statsStore = await this.addStore("stats", StoreType.SQL, statsMigrations);
    this.statsStoreService = new StatsStoreService(statsStore as SqlStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
