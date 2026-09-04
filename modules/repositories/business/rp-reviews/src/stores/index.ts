import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import metadataMigrations from "./metadata/migrations";
import { ReviewsMetadataStoreService } from "./metadata";

export class StoresController extends StoreControllerAbstract {
  public metadata: ReviewsMetadataStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const metadataStore = await this.addStore(
      "metadata",
      StoreType.SQL,
      metadataMigrations,
    );

    this.metadata = new ReviewsMetadataStoreService(metadataStore as SqlStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
