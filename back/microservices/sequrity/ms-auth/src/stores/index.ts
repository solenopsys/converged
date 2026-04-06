import { StoreControllerAbstract, StoreType, SqlStore, KVStore } from "back-core";
import { ClientsStoreService } from "./clients/service";
import { TokensStoreService } from "./tokens/service";
import clientsMigrations from "./clients/migrations";

export class StoresController extends StoreControllerAbstract {
  public clients: ClientsStoreService;
  public tokens: TokensStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const clientsStore = await this.addStore("clients", StoreType.SQL, clientsMigrations);
    const tokensStore = await this.addStore("tokens", StoreType.KVS, []);

    this.clients = new ClientsStoreService(clientsStore as SqlStore);
    this.tokens = new TokensStoreService(tokensStore as KVStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
