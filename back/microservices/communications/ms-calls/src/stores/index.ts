import {
  StoreControllerAbstract,
  StoreType,
  SqlStore,
  KVStore,
} from "back-core";
import { CallsStoreService } from "./calls/service";
import callsMigrations from "./calls/migrations";

export class StoresController extends StoreControllerAbstract {
  public calls!: CallsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const callsStore = await this.addStore(
      "calls",
      StoreType.SQL,
      callsMigrations as any,
    );
    const recordingsStore = await this.addStore(
      "recordings",
      StoreType.KVS,
      [],
    );
    const fragmentsStore = await this.addStore(
      "fragments",
      StoreType.KVS,
      [],
    );
    this.calls = new CallsStoreService(
      callsStore as SqlStore,
      recordingsStore as KVStore,
      fragmentsStore as KVStore,
    );

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
