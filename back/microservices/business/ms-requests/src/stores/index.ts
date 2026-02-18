import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { RequestsStoreService } from "./requests/service";
import requestsMigrations from "./requests/migrations";

export class StoresController extends StoreControllerAbstract {
  public requests: RequestsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const requestsStore = await this.addStore(
      "requests",
      StoreType.SQL,
      requestsMigrations,
    );
    this.requests = new RequestsStoreService(requestsStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
