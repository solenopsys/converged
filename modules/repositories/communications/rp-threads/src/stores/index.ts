import { StoreControllerAbstract, Store } from "back-core";
import { StoreType } from "back-core";
import { ThreadsStoreService } from "./threads/service";
import { ThreadIndexStoreService } from "./thread-index/service";
import threadIndexMigrations from "./thread-index/migrations";
import { KVStore, SqlStore } from "back-core";

export class StoresController extends StoreControllerAbstract {
  public threads: ThreadsStoreService;
  public index: ThreadIndexStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const threadsStore = await this.addStore("threads", StoreType.KVS, []);
    const indexStore = await this.addStore(
      "thread-index",
      StoreType.SQL,
      threadIndexMigrations,
    );
    this.threads = new ThreadsStoreService(threadsStore as KVStore);
    this.index = new ThreadIndexStoreService(indexStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
