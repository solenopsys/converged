import { StoreControllerAbstract, StoreType, JsonStore, KVStore, SqlStore } from "back-core";
import { ProcessingStoreService } from "./processing";
import { StatsStoreService } from "./stats";
import { TriggersStoreService } from "./triggers";
import statsMigrations from "./stats/migrations";

export class StoresController extends StoreControllerAbstract {
  public processingStoreService!: ProcessingStoreService;
  public statsStoreService!: StatsStoreService;
  public triggersStoreService!: TriggersStoreService;

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

    const triggersStore = await this.addStore("triggers", StoreType.JSON, []);
    this.triggersStoreService = new TriggersStoreService(triggersStore as JsonStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
