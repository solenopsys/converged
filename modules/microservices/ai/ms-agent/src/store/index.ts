import { StoreControllerAbstract, StoreType, type KVStore, type SqlStore } from "back-core";
import { HistoryStoreService } from "./history/services";
import { ProcessingStoreService } from "./processing/services";
import historyMigrations from "./history/migrations";

const MS_ID = "agent-ms";

export class StoresController extends StoreControllerAbstract {
  public history!: HistoryStoreService;
  public processing!: ProcessingStoreService;

  private static instance: StoresController | null = null;

  constructor(protected msName: string = MS_ID) {
    super(msName);
  }

  static async getInstance(): Promise<StoresController> {
    if (!StoresController.instance) {
      StoresController.instance = new StoresController();
      await StoresController.instance.init();
    }
    return StoresController.instance;
  }

  async init() {
    const historyStore = await this.addStore(
      "history",
      StoreType.SQL,
      historyMigrations,
    );
    this.history = new HistoryStoreService(historyStore as SqlStore);

    const processingStore = await this.addStore(
      "processing",
      StoreType.KVS,
      [],
    );
    this.processing = new ProcessingStoreService(
      processingStore as KVStore,
    );

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
