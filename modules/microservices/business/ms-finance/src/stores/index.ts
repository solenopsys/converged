import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { FinanceStoreService } from "./finance/service";
import financeMigrations from "./finance/migrations";

export class StoresController extends StoreControllerAbstract {
  public finance: FinanceStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const store = await this.addStore("finance", StoreType.SQL, financeMigrations);
    this.finance = new FinanceStoreService(store as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
