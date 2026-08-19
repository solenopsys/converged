import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { MedatataStoreService } from "./metadata/service";
import metadataMigrations from "./metadata/migrations";

export class StoresController extends StoreControllerAbstract {
  public metadataService: MedatataStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    // Contexts moved to ms-contexts (single owner) — no context store here.
    const metadataStore = await this.addStore(
      "metadata",
      StoreType.SQL,
      metadataMigrations,
    );
    this.metadataService = new MedatataStoreService(metadataStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
