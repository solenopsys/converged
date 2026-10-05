import { type SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import pinsMigrations from "./pins/migrations";
import { DashboardPinsStoreService } from "./pins/service";
import { DashboardChartCacheStoreService } from "./charts/service";

export class StoresController extends StoreControllerAbstract {
	public pins!: DashboardPinsStoreService;
	public charts!: DashboardChartCacheStoreService;

	async init(): Promise<void> {
		const pinsStore = await this.addStore(
			"pins",
			StoreType.SQL,
			pinsMigrations,
		);
		this.pins = new DashboardPinsStoreService(pinsStore as SqlStore);
		const chartsStore = await this.addStore("charts", StoreType.KVS, []);
		this.charts = new DashboardChartCacheStoreService(chartsStore as import("back-core").KVStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy(): Promise<void> {
		await this.closeAll();
	}
}
