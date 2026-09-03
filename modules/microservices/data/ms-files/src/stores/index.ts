import { type SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import metadataMigrations from "./metadata/migrations";
import { MetadataStoreService } from "./metadata/service";

export class StoresController extends StoreControllerAbstract {
	public metadataService: MetadataStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const metadataStore = await this.addStore(
			"metadata",
			StoreType.SQL,
			metadataMigrations,
		);
		this.metadataService = new MetadataStoreService(metadataStore as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
