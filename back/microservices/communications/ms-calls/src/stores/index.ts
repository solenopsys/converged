import {
  StoreControllerAbstract,
  StoreType,
  SqlStore,
  KVStore,
  JsonStore,
} from "back-core";
import { CallsStoreService } from "./calls/service";
import { ContextStoreService } from "./contexts/service";
import callsMigrations from "./calls/migrations";

export class StoresController extends StoreControllerAbstract {
  public calls!: CallsStoreService;
  public contexts!: ContextStoreService;

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
    // JSON store: call contexts are typed {instructions, language} entities the
    // gate reads by the llm-context/<name>.json key. (Was FILES holding a bare
    // prompt string — switched to JSON so language can live in the context.)
    const contextsStore = await this.addStore(
      "llm-gate-configs",
      StoreType.JSON,
      [],
    );

    this.calls = new CallsStoreService(
      callsStore as SqlStore,
      recordingsStore as KVStore,
      fragmentsStore as KVStore,
    );
    this.contexts = new ContextStoreService(contextsStore as JsonStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
