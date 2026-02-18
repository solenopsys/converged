import { StoreControllerAbstract, StoreType, SqlStore, KVStore } from "back-core";
import { CallsStoreService } from "./calls/service";
import callsMigrations from "./calls/migrations";

export class StoresController extends StoreControllerAbstract {
  public calls: CallsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const callsStore = await this.addStore(
      "calls",
      StoreType.SQL,
      callsMigrations,
    );
    const recordingsStore = await this.addStore(
      "recordings",
      StoreType.KVS,
      [],
    );

    this.calls = new CallsStoreService(
      callsStore as SqlStore,
      recordingsStore as KVStore,
    );

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
