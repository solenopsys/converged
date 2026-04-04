import { StoreControllerAbstract, Store } from "back-core";
import { StoreType } from "back-core";
import { ThreadsStoreService } from "./threads/service";
import { KVStore } from "back-core";

export class StoresController extends StoreControllerAbstract {
  public threads: ThreadsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const threadsStore = await this.addStore("threads", StoreType.KVS, []);
    this.threads = new ThreadsStoreService(threadsStore as KVStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
