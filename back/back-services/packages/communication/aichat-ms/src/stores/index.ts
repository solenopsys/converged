import { StoreControllerAbstract, Store } from "back-core";
import { StoreType } from "back-core";
import { MedatataStoreService } from "./metadata/service";
import metadataMigrations from "./metadata/migrations";
import { SqlStore } from "back-core";

export class StoresController extends StoreControllerAbstract {
    public  metadataService: MedatataStoreService;


    constructor(protected msName: string) {
        super(msName);
    }


    async init() {
        const metadataStore =  await this.addStore("metadata", StoreType.SQL, metadataMigrations);
        this.metadataService = new MedatataStoreService(metadataStore as SqlStore);
        await this.startAll();
        await this.migrateAll();
    }

    async destroy() {
        await this.closeAll();
    }
}