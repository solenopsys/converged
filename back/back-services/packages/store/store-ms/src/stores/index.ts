
import { StoreControllerAbstract, StoreType } from "back-core";
import { StoreKVService } from "./kv-service";
import { KVStore } from "back-core";

export class StoresController extends StoreControllerAbstract {
    public store: StoreKVService;

    constructor(protected msName: string) {
        super(msName);
    }

    async init() {
        const store = await this.addStore("store", StoreType.KVS, []);
        this.store = new StoreKVService(store as KVStore);
        await this.startAll();
        await this.migrateAll();
    }

    async destroy() {
        await this.closeAll();
    }
}
