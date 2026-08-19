import { StoresController } from "./stores";
import type {
	Order,
	OrderDashboard,
	OrderId,
	OrderInput,
	OrderListParams,
	OrderPatch,
	OrdersService,
	OrderStatus,
	PaginatedResult,
} from "./types";

const MS_ID = "orders-ms";

export class OrdersServiceImpl implements OrdersService {
	stores: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(MS_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	createOrder(input: OrderInput): Promise<OrderId> {
		return this.stores.orders.createOrder(input);
	}

	getOrder(id: OrderId): Promise<Order | undefined> {
		return this.stores.orders.getOrder(id);
	}

	listOrders(params: OrderListParams): Promise<PaginatedResult<Order>> {
		return this.stores.orders.listOrders(params);
	}

	patchOrder(id: OrderId, patch: OrderPatch): Promise<Order> {
		return this.stores.orders.patchOrder(id, patch);
	}

	updateStatus(id: OrderId, status: OrderStatus): Promise<void> {
		return this.stores.orders.updateStatus(id, status);
	}

	getOrderDashboard(): Promise<OrderDashboard> {
		return this.stores.orders.getOrderDashboard();
	}
}
