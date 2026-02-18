import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import usageMigrations from "./usage/migrations";
import { UsageStoreService } from "./usage/service";

export class StoresController extends StoreControllerAbstract {
  public usage!: UsageStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init(): Promise<void> {
    const usageStore = await this.addStore("usage", StoreType.SQL, usageMigrations);
    this.usage = new UsageStoreService(usageStore as SqlStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy(): Promise<void> {
    await this.closeAll();
  }
}
