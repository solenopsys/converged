import { type SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import staffMigrations from "./staff/migrations";
import { StaffStoreService } from "./staff/service";

export class StoresController extends StoreControllerAbstract {
	public staff: StaffStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const staffStore = await this.addStore(
			"staff",
			StoreType.SQL,
			staffMigrations,
		);
		this.staff = new StaffStoreService(staffStore as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
