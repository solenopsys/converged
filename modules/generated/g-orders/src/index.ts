// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type OrderId = string;

export type RequestId = string;

export type EquipmentId = string;

export type ISODateString = string;

export type OrderStatus = | "draft"
	| "queued"
	| "in_progress"
	| "paused"
	| "completed"
	| "cancelled"
	| "blocked";

export type OrderStatusGroup = | "all"
	| "queued"
	| "in_progress"
	| "completed"
	| "blocked";

export type OrderProductionMethod = | "fdm"
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

export const metadata: ServiceMetadata = {
  "interfaceName": "OrdersService",
  "serviceName": "orders",
  "filePath": "business/orders.ts",
  "methods": [
    {
      "name": "createOrder",
      "parameters": [
        {
          "name": "input",
          "type": "OrderInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "OrderId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getOrder",
      "parameters": [
        {
          "name": "id",
          "type": "OrderId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Order | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listOrders",
      "parameters": [
        {
          "name": "params",
          "type": "OrderListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Order>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "describeSelection",
      "parameters": [
        {
          "name": "objectType",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "SelectionDescriptor",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "inspectOrders",
      "parameters": [
        {
          "name": "filter",
          "type": "FilterObject",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "SelectionStats",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "patchOrder",
      "parameters": [
        {
          "name": "id",
          "type": "OrderId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "OrderPatch",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Order",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updateStatus",
      "parameters": [
        {
          "name": "id",
          "type": "OrderId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "status",
          "type": "OrderStatus",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getOrderDashboard",
      "parameters": [],
      "returnType": "OrderDashboard",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "OrderId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "RequestId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "EquipmentId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "OrderStatus",
      "kind": "type",
      "definition": "| \"draft\"\n\t| \"queued\"\n\t| \"in_progress\"\n\t| \"paused\"\n\t| \"completed\"\n\t| \"cancelled\"\n\t| \"blocked\""
    },
    {
      "name": "OrderStatusGroup",
      "kind": "type",
      "definition": "| \"all\"\n\t| \"queued\"\n\t| \"in_progress\"\n\t| \"completed\"\n\t| \"blocked\""
    },
    {
      "name": "OrderProductionMethod",
      "kind": "type",
      "definition": "| \"fdm\"\n\t| \"sla\"\n\t| \"sls\"\n\t| \"dmls\"\n\t| \"polyjet\"\n\t| \"cnc\"\n\t| \"laser\"\n\t| \"generic\""
    },
    {
      "name": "Order",
      "kind": "type",
      "definition": "{\n\tid: OrderId;\n\trequestId?: RequestId;\n\tmodelName: string;\n\tproductionMethod: OrderProductionMethod;\n\tstatus: OrderStatus;\n\tquantity: number;\n\tweightGrams?: number;\n\tmaterial?: string;\n\tequipmentId?: EquipmentId;\n\tdueAt?: ISODateString;\n\tnotes?: string;\n\tcreatedAt: ISODateString;\n\tupdatedAt: ISODateString;\n}"
    },
    {
      "name": "OrderInput",
      "kind": "type",
      "definition": "{\n\trequestId?: RequestId;\n\tmodelName: string;\n\tproductionMethod: OrderProductionMethod;\n\tstatus?: OrderStatus;\n\tquantity?: number;\n\tweightGrams?: number;\n\tmaterial?: string;\n\tequipmentId?: EquipmentId;\n\tdueAt?: ISODateString;\n\tnotes?: string;\n}"
    },
    {
      "name": "OrderPatch",
      "kind": "type",
      "definition": "{\n\trequestId?: RequestId;\n\tmodelName?: string;\n\tproductionMethod?: OrderProductionMethod;\n\tstatus?: OrderStatus;\n\tquantity?: number;\n\tweightGrams?: number;\n\tmaterial?: string;\n\tequipmentId?: EquipmentId;\n\tdueAt?: ISODateString;\n\tnotes?: string;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "SelectionFieldDescriptor",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tlabel: string;\n\tvalueType: \"string\" | \"number\" | \"boolean\" | \"date\" | \"enum\";\n\toperators: string[];\n}"
    },
    {
      "name": "SelectionDescriptor",
      "kind": "type",
      "definition": "{\n\tobjectType: string;\n\ttitle: string;\n\tfields: SelectionFieldDescriptor[];\n\tfilterExample?: FilterObject;\n\trevision?: string;\n}"
    },
    {
      "name": "SelectionStats",
      "kind": "type",
      "definition": "{ totalCount: number }"
    },
    {
      "name": "OrderListParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\trequestId?: RequestId;\n\tstatus?: OrderStatus;\n\tstatusGroup?: OrderStatusGroup;\n\tproductionMethod?: OrderProductionMethod;\n\tfilter?: FilterObject;\n}"
    },
    {
      "name": "OrderStatusCount",
      "kind": "type",
      "definition": "{\n\tgroup: OrderStatusGroup;\n\tcount: number;\n}"
    },
    {
      "name": "OrderDailyPoint",
      "kind": "type",
      "definition": "{\n\tdate: string;\n\torders: number;\n\tinProgress: number;\n\tcompleted: number;\n\tmaterialWeightGrams: number;\n}"
    },
    {
      "name": "OrderDashboardStats",
      "kind": "type",
      "definition": "{\n\tordersTotal: number;\n\tqueuedTotal: number;\n\tinProgressTotal: number;\n\tprintingTotal: number;\n\tcompletedTotal: number;\n\tblockedTotal: number;\n\tmaterialWeightGrams: number;\n\testimatedPrintingHours: number;\n\tavailablePrinters: number;\n\tprinterCapacity: number;\n\tutilizationPercent: number;\n}"
    },
    {
      "name": "OrderDashboard",
      "kind": "type",
      "definition": "{\n\tstats: OrderDashboardStats;\n\tdaily: OrderDailyPoint[];\n\tstatusCounts: OrderStatusCount[];\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface OrdersService {
  createOrder(input: OrderInput): Promise<OrderId>;
  getOrder(id: OrderId): Promise<Order | any>;
  listOrders(params: OrderListParams): Promise<PaginatedResult<Order>>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectOrders(filter?: FilterObject): Promise<SelectionStats>;
  patchOrder(id: OrderId, patch: OrderPatch): Promise<Order>;
  updateStatus(id: OrderId, status: OrderStatus): Promise<void>;
  getOrderDashboard(): Promise<OrderDashboard>;
}

// Client interface
export interface OrdersServiceClient {
  createOrder(input: OrderInput): Promise<OrderId>;
  getOrder(id: OrderId): Promise<Order | any>;
  listOrders(params: OrderListParams): Promise<PaginatedResult<Order>>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectOrders(filter?: FilterObject): Promise<SelectionStats>;
  patchOrder(id: OrderId, patch: OrderPatch): Promise<Order>;
  updateStatus(id: OrderId, status: OrderStatus): Promise<void>;
  getOrderDashboard(): Promise<OrderDashboard>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createOrdersServiceClient(
  config: CrullerTransportClientConfig,
): OrdersServiceClient {
  return createCrullerTransportClient<OrdersServiceClient>(metadata, config);
}

export function createOrdersServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): OrdersServiceClient {
  return createOrdersServiceClient(config);
}
