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
	SelectionDescriptor,
	SelectionStats,
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

	async describeSelection(objectType: string): Promise<SelectionDescriptor> {
		if (objectType !== "orders.order") {
			throw new Error(`Unsupported order selection object: ${objectType}`);
		}
		return {
			objectType,
			title: "Orders",
			fields: [
				{ id: "requestId", label: "Request", valueType: "string", operators: ["eq", "in", "isNull"] },
				{ id: "status", label: "Status", valueType: "enum", operators: ["eq", "in", "notEq", "notIn"] },
				{ id: "productionMethod", label: "Production method", valueType: "string", operators: ["eq", "in"] },
				{ id: "dueAt", label: "Due date", valueType: "date", operators: ["isNull", "isNotNull", "gte", "lte", "between"] },
				{ id: "createdAt", label: "Created", valueType: "date", operators: ["gte", "lte", "between"] },
			],
			filterExample: { status: { eq: "queued" } },
			revision: "orders-v1",
		};
	}

	async inspectOrders(filter?: Record<string, unknown>): Promise<SelectionStats> {
		await this.init();
		return { totalCount: await this.stores.orders.countOrders(filter) };
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
