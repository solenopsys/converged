import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { UsersStoreService } from "./users/service";
import usersMigrations from "./users/migrations";

export class StoresController extends StoreControllerAbstract {
  public users: UsersStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const usersStore = await this.addStore("users", StoreType.SQL, usersMigrations);
    this.users = new UsersStoreService(usersStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
