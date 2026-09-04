import { KVStore, SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import migrations from "./migrations";
import { ContentStoreService, MetaStoreService } from "./services";

export class StoresController extends StoreControllerAbstract {
  public meta!: MetaStoreService;
  public content!: ContentStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const metaStore = await this.addStore("meta", StoreType.SQL, migrations as any);
    const contentStore = await this.addStore("content", StoreType.KVS, []);

    await this.startAll();
    await this.migrateAll();

    this.meta = new MetaStoreService(metaStore as SqlStore);
    this.content = new ContentStoreService(contentStore as KVStore);
  }

  async destroy() {
    await this.closeAll();
  }
}
