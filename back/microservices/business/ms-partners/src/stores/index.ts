import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { PartnersStoreService } from "./partners/service";
import partnersMigrations from "./partners/migrations";

export class StoresController extends StoreControllerAbstract {
  public partners: PartnersStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const partnersStore = await this.addStore(
      "partners",
      StoreType.SQL,
      partnersMigrations,
    );
    this.partners = new PartnersStoreService(partnersStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
