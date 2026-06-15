import { StoreControllerAbstract, StoreType, JsonStore } from "back-core";
import { ContextStoreService } from "./contexts/service";

export class StoresController extends StoreControllerAbstract {
  public contexts!: ContextStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    // Single JSON store for this service. Subdivision is by key
    // (`<lang>/<name>`), not by extra stores.
    const contextsStore = await this.addStore("contexts", StoreType.JSON, []);
    this.contexts = new ContextStoreService(contextsStore as JsonStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
