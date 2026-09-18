import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import supportMigrations from "./support/migrations";
import { SupportStoreService } from "./support/service";

export class StoresController extends StoreControllerAbstract {
	public support!: SupportStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init(): Promise<void> {
		const store = await this.addStore("support", StoreType.SQL, supportMigrations);
		this.support = new SupportStoreService(store as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy(): Promise<void> {
		await this.closeAll();
	}
}
