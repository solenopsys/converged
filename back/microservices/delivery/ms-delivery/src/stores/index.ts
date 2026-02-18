import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { DeliveryStoreService } from "./delivery/service";
import deliveryMigrations from "./delivery/migrations";

export class StoresController extends StoreControllerAbstract {
  public delivery: DeliveryStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const deliveryStore = await this.addStore(
      "delivery",
      StoreType.SQL,
      deliveryMigrations,
    );
    this.delivery = new DeliveryStoreService(deliveryStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
