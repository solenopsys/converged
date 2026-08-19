import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { BillingStoreService } from "./entries/service";
import entriesMigrations from "./entries/migrations";

export class StoresController extends StoreControllerAbstract {
  public billing: BillingStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const billingStore = await this.addStore(
      "billing",
      StoreType.SQL,
      entriesMigrations,
    );
    this.billing = new BillingStoreService(billingStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
