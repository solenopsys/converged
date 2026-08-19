import { StoreControllerAbstract, StoreType, ColumnStore } from "back-core";
import eventsMigrations from "./events/migrations";
import { TelemetryStoreService } from "./events/service";

export class StoresController extends StoreControllerAbstract {
  public hot!: TelemetryStoreService;
  public cold!: TelemetryStoreService;

  constructor(msName: string) {
    super(msName);
  }

  async init(): Promise<void> {
    const hotStore = await this.addStore("hot", StoreType.COLUMN, eventsMigrations);
    const coldStore = await this.addStore("cold", StoreType.COLUMN, eventsMigrations);
    this.hot = new TelemetryStoreService(hotStore as ColumnStore);
    this.cold = new TelemetryStoreService(coldStore as ColumnStore);
    await this.startAll();
    await this.migrateAll();
  }

  async destroy(): Promise<void> {
    await this.closeAll();
  }
}
