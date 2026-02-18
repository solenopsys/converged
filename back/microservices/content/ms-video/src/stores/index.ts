import {
  StoreControllerAbstract,
  StoreType,
  SqlStore,
  FileStore,
} from "back-core";
import metadataMigrations from "./metadata/migrations";
import { VideoMetadataStoreService } from "./metadata";
import { createVideoThumbsService, VideoThumbsStoreService } from "./thumbs";

export class StoresController extends StoreControllerAbstract {
  public thumbs: FileStore;
  public thumbsService: VideoThumbsStoreService;
  public metadata: VideoMetadataStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const thumbsStore = await this.addStore("thumbs", StoreType.FILES, []);
    const metadataStore = await this.addStore(
      "metadata",
      StoreType.SQL,
      metadataMigrations,
    );

    this.thumbs = thumbsStore as FileStore;
    this.thumbsService = createVideoThumbsService(this.thumbs);
    this.metadata = new VideoMetadataStoreService(metadataStore as SqlStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
