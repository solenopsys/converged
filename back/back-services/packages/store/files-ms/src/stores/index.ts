
import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import { MetadataStoreService } from "./metadata/service";
import metadataMigrations from "./metadata/migrations";

export class StoresController extends StoreControllerAbstract {
    public metadataService: MetadataStoreService;

    constructor(protected msName: string) {
        super(msName);
    }

    async init() {
        console.log("Migration:", metadataMigrations);
        const metadataStore = await this.addStore("metadata", StoreType.SQL, metadataMigrations);
        this.metadataService = new MetadataStoreService(metadataStore as SqlStore);
        await this.startAll();
        await this.migrateAll();
    }

    async destroy() {
        await this.closeAll();
    }
}
