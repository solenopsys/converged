import { SqlStore, StoreControllerAbstract, StoreType } from "back-core";
import ordersMigrations from "./orders/migrations";
import { OrdersStoreService } from "./orders/service";

export class StoresController extends StoreControllerAbstract {
	public orders: OrdersStoreService;

	constructor(protected msName: string) {
		super(msName);
	}

	async init() {
		const ordersStore = await this.addStore(
			"orders",
			StoreType.SQL,
			ordersMigrations,
		);
		this.orders = new OrdersStoreService(ordersStore as SqlStore);
		await this.startAll();
		await this.migrateAll();
	}

	async destroy() {
		await this.closeAll();
	}
}
