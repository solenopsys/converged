export type OrderId = string;
export type RequestId = string;
export type EquipmentId = string;
export type ISODateString = string;

export type OrderStatus =
	| "draft"
	| "queued"
	| "in_progress"
	| "paused"
	| "completed"
	| "cancelled"
	| "blocked";

export type OrderStatusGroup =
	| "all"
	| "queued"
	| "in_progress"
	| "completed"
	| "blocked";

export type OrderProductionMethod =
	| "fdm"
	| "sla"
	| "sls"
	| "dmls"
	| "polyjet"
	| "cnc"
	| "laser"
	| "generic";

export type Order = {
	id: OrderId;
	requestId?: RequestId;
	modelName: string;
	productionMethod: OrderProductionMethod;
	status: OrderStatus;
	quantity: number;
	weightGrams?: number;
	material?: string;
	equipmentId?: EquipmentId;
	dueAt?: ISODateString;
	notes?: string;
	/**
	 * Who the work is for, and how to reach them.
	 *
	 * There is no customer directory in this platform — the shop's contact with
	 * the person is the order itself. The review funnel is the first thing that
	 * needs to write to that person after the work is done, and a contact it has
	 * to be told on every run is a contact that is wrong half the time.
	 */
	customerName?: string;
	customerEmail?: string;
	/** Language the customer is written to in; falls back to the shop's. */
	customerLang?: string;
	createdAt: ISODateString;
	updatedAt: ISODateString;
};

export type OrderInput = {
	requestId?: RequestId;
	modelName: string;
	productionMethod: OrderProductionMethod;
	status?: OrderStatus;
	quantity?: number;
	weightGrams?: number;
	material?: string;
	equipmentId?: EquipmentId;
	dueAt?: ISODateString;
	notes?: string;
	customerName?: string;
	customerEmail?: string;
	customerLang?: string;
};

export type OrderPatch = {
	requestId?: RequestId;
	modelName?: string;
	productionMethod?: OrderProductionMethod;
	status?: OrderStatus;
	quantity?: number;
	weightGrams?: number;
	material?: string;
	equipmentId?: EquipmentId;
	dueAt?: ISODateString;
	notes?: string;
	customerName?: string;
	customerEmail?: string;
	customerLang?: string;
};

export type FilterObject = Record<string, unknown>;

export type SelectionFieldDescriptor = {
	id: string;
	label: string;
	valueType: "string" | "number" | "boolean" | "date" | "enum";
	operators: string[];
};

export type SelectionDescriptor = {
	objectType: string;
	title: string;
	fields: SelectionFieldDescriptor[];
	filterExample?: FilterObject;
	revision?: string;
};

export type SelectionStats = { totalCount: number };

export type OrderListParams = {
	offset: number;
	limit: number;
	requestId?: RequestId;
	status?: OrderStatus;
	statusGroup?: OrderStatusGroup;
	productionMethod?: OrderProductionMethod;
	filter?: FilterObject;
};

export type OrderStatusCount = {
	group: OrderStatusGroup;
	count: number;
};

export type OrderDailyPoint = {
	date: string;
	orders: number;
	inProgress: number;
	completed: number;
	materialWeightGrams: number;
};

export type OrderDashboardStats = {
	ordersTotal: number;
	queuedTotal: number;
	inProgressTotal: number;
	printingTotal: number;
	completedTotal: number;
	blockedTotal: number;
	materialWeightGrams: number;
	estimatedPrintingHours: number;
	availablePrinters: number;
	printerCapacity: number;
	utilizationPercent: number;
};

export type OrderDashboard = {
	stats: OrderDashboardStats;
	daily: OrderDailyPoint[];
	statusCounts: OrderStatusCount[];
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export interface OrdersService {
	createOrder(input: OrderInput): Promise<OrderId>;
	getOrder(id: OrderId): Promise<Order | undefined>;
	listOrders(params: OrderListParams): Promise<PaginatedResult<Order>>;
	describeSelection(objectType: string): Promise<SelectionDescriptor>;
	inspectOrders(filter?: FilterObject): Promise<SelectionStats>;
	patchOrder(id: OrderId, patch: OrderPatch): Promise<Order>;
	updateStatus(id: OrderId, status: OrderStatus): Promise<void>;
	getOrderDashboard(): Promise<OrderDashboard>;
}
