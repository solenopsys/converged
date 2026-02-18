import { StoreControllerAbstract, StoreType, FileStore, SqlStore } from "back-core";
import { MedatataStoreService } from "./metadata/service";
import metadataMigrations from "./metadata/migrations";
import { ContextStoreService } from "./contexts/service";

export class StoresController extends StoreControllerAbstract {
  public contextService: ContextStoreService;
  public metadataService: MedatataStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const contextsStore = await this.addStore("contexts", StoreType.FILES, []);
    this.contextService = new ContextStoreService(contextsStore as FileStore);

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
