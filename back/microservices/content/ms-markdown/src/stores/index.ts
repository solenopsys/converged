import { StoreControllerAbstract, StoreType, FileStore } from "back-core";

export class StoresController extends StoreControllerAbstract {
  public fileStore: FileStore;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    // Файловое хранилище для markdown файлов
    const fileStore = await this.addStore("markdown", StoreType.FILES, []);
    this.fileStore = fileStore as FileStore;

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
