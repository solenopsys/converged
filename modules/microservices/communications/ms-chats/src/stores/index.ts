import { StoreControllerAbstract, StoreType, SqlStore, FileStore } from "back-core";
import chatsMigrations from "./chats/migrations";
import { ChatsStoreService } from "./chats/service";
import { ContextStoreService } from "./contexts/service";

export class StoresController extends StoreControllerAbstract {
  public chats: ChatsStoreService;
  public contexts: ContextStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const chatsStore = await this.addStore("chats", StoreType.SQL, chatsMigrations);
    const contextsStore = await this.addStore("contexts", StoreType.FILES, []);

    this.chats = new ChatsStoreService(chatsStore as SqlStore);
    this.contexts = new ContextStoreService(contextsStore as FileStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
