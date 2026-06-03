import { type SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import pinsMigrations from "./pins/migrations";
import { DashboardPinsStoreService } from "./pins/service";

export class StoresController extends StoreControllerAbstract {
	public pins!: DashboardPinsStoreService;

	async init(): Promise<void> {
		const pinsStore = await this.addStore(
			"pins",
			StoreType.SQL,
			pinsMigrations,
		);
		this.pins = new DashboardPinsStoreService(pinsStore as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy(): Promise<void> {
		await this.closeAll();
	}
}
