import {
	type FileStore,
	type SqlStore,
	StoreControllerAbstract,
	StoreType,
} from "back-core";
import metadataMigrations from "./metadata/migrations";
import { MetadataStoreService } from "./metadata/service";

export class StoresController extends StoreControllerAbstract {
	public chunkStore!: FileStore;
	public metadataService: MetadataStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		this.chunkStore = (await this.addStore(
			"chunks",
			StoreType.FILES,
			[],
		)) as FileStore;
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
