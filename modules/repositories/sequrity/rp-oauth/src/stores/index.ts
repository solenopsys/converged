import { StoreControllerAbstract, StoreType, SqlStore, KVStore } from "back-core";
import providersMigrations from "./providers/migrations";
import { OAuthProvidersStoreService } from "./providers/service";
import { OAuthStatesStoreService } from "./states/service";

export class StoresController extends StoreControllerAbstract {
  public providers: OAuthProvidersStoreService;
  public states: OAuthStatesStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const providersStore = await this.addStore(
      "providers",
      StoreType.SQL,
      providersMigrations,
    );
    const statesStore = await this.addStore("states", StoreType.KVS, []);

    this.providers = new OAuthProvidersStoreService(providersStore as SqlStore);
    this.states = new OAuthStatesStoreService(statesStore as KVStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
