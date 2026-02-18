import {
  StoreControllerAbstract,
  StoreType,
  SqlStore,
  FileStore,
} from "back-core";
import { ChunkMetadataService } from "./metadata/service";
import metadataMigrations from "./metadata/migrations";

export class StoresController extends StoreControllerAbstract {
  public fileStore: FileStore;
  public metadataService: ChunkMetadataService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    // Файловое хранилище для данных чанков
    const fileStore = await this.addStore("chunks", StoreType.FILES, []);
    this.fileStore = fileStore as FileStore;

    // SQL хранилище для метаданных
    const sqlStore = await this.addStore(
      "metadata",
      StoreType.SQL,
      metadataMigrations,
    );
    this.metadataService = new ChunkMetadataService(sqlStore as SqlStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
