import { StoreControllerAbstract, StoreType, JsonStore } from "back-core";
import { FunctionsStoreService } from "./functions/service";
import { EmbeddingsStoreService } from "./embeddings/service";

export class StoresController extends StoreControllerAbstract {
  public functions: FunctionsStoreService;
  public embeddings: EmbeddingsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const functionsStore = await this.addStore("functions", StoreType.JSON, []);
    const embeddingsStore = await this.addStore("embeddings", StoreType.JSON, []);

    this.functions = new FunctionsStoreService(functionsStore as JsonStore);
    this.embeddings = new EmbeddingsStoreService(embeddingsStore as JsonStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
