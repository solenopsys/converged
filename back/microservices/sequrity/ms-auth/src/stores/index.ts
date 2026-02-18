import { StoreControllerAbstract, StoreType, SqlStore, KVStore } from "back-core";
import { UsersStoreService } from "./users/service";
import { TokensStoreService } from "./tokens/service";
import usersMigrations from "./users/migrations";

export class StoresController extends StoreControllerAbstract {
  public users: UsersStoreService;
  public tokens: TokensStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const usersStore = await this.addStore("users", StoreType.SQL, usersMigrations);
    const tokensStore = await this.addStore("tokens", StoreType.KVS, []);

    this.users = new UsersStoreService(usersStore as SqlStore);
    this.tokens = new TokensStoreService(tokensStore as KVStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
