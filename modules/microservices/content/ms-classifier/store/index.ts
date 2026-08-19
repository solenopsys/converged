import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { SqlStoreService } from "./services";
import sqlMigrations from "./migrations";

export class StoresController extends StoreControllerAbstract {
  public sqlStoreService!: SqlStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const sqlStore = await this.addStore("nodes", StoreType.SQL, sqlMigrations);
    await this.startAll();
    await this.migrateAll();
    this.sqlStoreService = new SqlStoreService(sqlStore as SqlStore);
  }

  async destroy() {
    await this.closeAll();
  }
}
