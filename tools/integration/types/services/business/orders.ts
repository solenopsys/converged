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
};

export type OrderListParams = {
	offset: number;
	limit: number;
	requestId?: RequestId;
	status?: OrderStatus;
	statusGroup?: OrderStatusGroup;
	productionMethod?: OrderProductionMethod;
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
	completedTotal: number;
	blockedTotal: number;
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
	patchOrder(id: OrderId, patch: OrderPatch): Promise<Order>;
	updateStatus(id: OrderId, status: OrderStatus): Promise<void>;
	getOrderDashboard(): Promise<OrderDashboard>;
}
