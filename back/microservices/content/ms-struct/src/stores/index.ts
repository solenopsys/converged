import {
  StoreControllerAbstract,
  StoreType,
  FileStore,
} from "back-core";

export class StoresController extends StoreControllerAbstract {
  public fileStore: FileStore;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    // Файловое хранилище для JSON файлов
    const fileStore = await this.addStore("struct", StoreType.FILES, []);
    this.fileStore = fileStore as FileStore;

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
