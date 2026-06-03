import { type SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import { SalesStoreService } from "./sales";
import metadataMigrations from "./sales/migrations";

export class StoresController extends StoreControllerAbstract {
	public salesStoreSevice: SalesStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const salesStore = await this.addStore(
			"sales",
			StoreType.SQL,
			metadataMigrations,
		);
		this.salesStoreSevice = new SalesStoreService(salesStore as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
