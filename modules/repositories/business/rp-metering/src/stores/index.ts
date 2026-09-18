import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import meterMigrations from "./meter/migrations";
import { MeterStoreService } from "./meter/service";

export class StoresController extends StoreControllerAbstract {
	public meter!: MeterStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init(): Promise<void> {
		const meterStore = await this.addStore("meter", StoreType.SQL, meterMigrations);
		this.meter = new MeterStoreService(meterStore as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy(): Promise<void> {
		await this.closeAll();
	}
}
