import {
  StoreControllerAbstract,
  StoreType,
  SqlStore,
  FileStore,
} from "back-core";
import { GaleryFilesRepository, GaleryFilesStoreService } from "./files";
import { GaleryStoreService, GaleryImagesStoreService, migrations } from "./metadata";

export class StoresController extends StoreControllerAbstract {
  public files: FileStore;
  public filesService: GaleryFilesStoreService;
  public galeries: GaleryStoreService;
  public images: GaleryImagesStoreService;
  public static: FileStore;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const filesStore = await this.addStore("files", StoreType.FILES, []);
    const metadataStore = await this.addStore("metadata", StoreType.SQL, migrations);
    const staticStore = await this.addStore("static", StoreType.FILES, []);

    this.files = filesStore as FileStore;
    const filesRepo = new GaleryFilesRepository(this.files);
    this.filesService = new GaleryFilesStoreService(filesRepo);
    this.galeries = new GaleryStoreService(metadataStore as SqlStore);
    this.images = new GaleryImagesStoreService(metadataStore as SqlStore);
    this.static = staticStore as FileStore;

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
