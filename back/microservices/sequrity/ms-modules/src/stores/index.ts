import { StoreControllerAbstract, StoreType, SqlStore, JsonStore } from "back-core";
import { ConfigStoreService } from "./config/service";
import { UsersStoreService } from "./users/service";
import usersMigrations from "./users/migrations";

export class StoresController extends StoreControllerAbstract {
  public config: ConfigStoreService;
  public users: UsersStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const configStore = await this.addStore("config", StoreType.JSON, []);
    const usersStore = await this.addStore("users", StoreType.SQL, usersMigrations);

    this.config = new ConfigStoreService(configStore as JsonStore);
    this.users = new UsersStoreService(usersStore as SqlStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
