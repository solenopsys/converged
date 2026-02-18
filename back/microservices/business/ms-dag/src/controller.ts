import { StoresController } from "./store";
import type { ProcessingStoreService } from "./store/processing";
import type { StatsStoreService } from "./store/stats";
import { getDagRegistry, type DagRegistry } from "./registry";

class StoreController {
  private static instance: StoreController | undefined;
  private stores!: StoresController;
  private initPromise: Promise<void>;

  public registry!: DagRegistry;
  public processing!: ProcessingStoreService;
  public stats!: StatsStoreService;

  private constructor() {
    this.initPromise = this.init();
  }

  private async init() {
    this.stores = new StoresController("dag-ms");
    await this.stores.init();
    this.processing = this.stores.processingStoreService;
    this.stats = this.stores.statsStoreService;
    this.registry = getDagRegistry();
  }

  async close() {
    await this.stores?.destroy();
  }

  public static async getInstance(): Promise<StoreController> {
    if (!StoreController.instance) {
      StoreController.instance = new StoreController();
    }
    await StoreController.instance.initPromise;
    return StoreController.instance;
  }
}

export { StoreController };
