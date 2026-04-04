import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { SqlStoreService } from "./services";
import sqlMigrations from "./migrations";

export class StoresController extends StoreControllerAbstract {
  public sqlStoreService!: SqlStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const sqlStore = await this.addStore("sql", StoreType.SQL, sqlMigrations);
    this.sqlStoreService = new SqlStoreService(sqlStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
