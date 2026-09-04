import { type FileStore, StoreControllerAbstract, StoreType } from "back-core";
import { CountersStoreService } from "./counters/service";

export class StoresController extends StoreControllerAbstract {
	public counters!: CountersStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init(): Promise<void> {
		// JSON file storage; the FileStore is partitioned per tenant (scope),
		// so counter codes are automatically isolated per workspace.
		const fileStore = await this.addStore("counters", StoreType.FILES, []);
		this.counters = new CountersStoreService(fileStore as FileStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy(): Promise<void> {
		await this.closeAll();
	}
}
