// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type UsageEventInput = {
  function: string;
  user: string;
  date?: string;
};

export type UsageEvent = {
  id: string;
  function: string;
  user: string;
  date: string;
  createdAt?: string;
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

export type UsageListParams = {
  offset: number;
  limit: number;
  function?: string;
  user?: string;
  dateFrom?: string;
  dateTo?: string;
  filter?: FilterObject;
};

export type UsageStatsParams = {
  function?: string;
  user?: string;
  dateFrom?: string;
  dateTo?: string;
  filter?: FilterObject;
};

export type UsageTotalStats = {
  total: number;
};

export type UsageDailyStatsItem = {
  date: string;
  total: number;
};

export type UsageFunctionStatsItem = {
  function: string;
  total: number;
};

export type UsageStatistic = {
	total: number;
	daily: UsageDailyStatsItem[];
	functions: number;
};

export type UsageStatisticKey = "title";

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "UsageService",
  "serviceName": "usage",
  "filePath": "analytics/usage.ts",
  "methods": [
    {
      "name": "recordUsage",
      "parameters": [
        {
          "name": "events",
          "type": "UsageEventInput",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listUsage",
      "parameters": [
        {
          "name": "params",
          "type": "UsageListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<UsageEvent>",
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
      "name": "inspectUsage",
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
      "name": "getUsageTotal",
      "parameters": [
        {
          "name": "params",
          "type": "UsageStatsParams",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "UsageTotalStats",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getUsageDaily",
      "parameters": [
        {
          "name": "params",
          "type": "UsageStatsParams",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "UsageDailyStatsItem",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getUsageByFunction",
      "parameters": [
        {
          "name": "params",
          "type": "UsageStatsParams",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "UsageFunctionStatsItem",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getStatistic",
      "parameters": [
        {
          "name": "keys",
          "type": "UsageStatisticKey",
          "optional": true,
          "isArray": true
        }
      ],
      "returnType": "UsageStatistic",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "UsageEventInput",
      "kind": "type",
      "definition": "{\n  function: string;\n  user: string;\n  date?: string;\n}"
    },
    {
      "name": "UsageEvent",
      "kind": "type",
      "definition": "{\n  id: string;\n  function: string;\n  user: string;\n  date: string;\n  createdAt?: string;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "SelectionFieldDescriptor",
      "kind": "type",
      "definition": "{\n  id: string;\n  label: string;\n  valueType: \"string\" | \"number\" | \"boolean\" | \"date\" | \"enum\";\n  operators: string[];\n}"
    },
    {
      "name": "SelectionDescriptor",
      "kind": "type",
      "definition": "{\n  objectType: string;\n  title: string;\n  fields: SelectionFieldDescriptor[];\n  filterExample?: FilterObject;\n  revision?: string;\n}"
    },
    {
      "name": "SelectionStats",
      "kind": "type",
      "definition": "{ totalCount: number }"
    },
    {
      "name": "UsageListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  function?: string;\n  user?: string;\n  dateFrom?: string;\n  dateTo?: string;\n  filter?: FilterObject;\n}"
    },
    {
      "name": "UsageStatsParams",
      "kind": "type",
      "definition": "{\n  function?: string;\n  user?: string;\n  dateFrom?: string;\n  dateTo?: string;\n  filter?: FilterObject;\n}"
    },
    {
      "name": "UsageTotalStats",
      "kind": "type",
      "definition": "{\n  total: number;\n}"
    },
    {
      "name": "UsageDailyStatsItem",
      "kind": "type",
      "definition": "{\n  date: string;\n  total: number;\n}"
    },
    {
      "name": "UsageFunctionStatsItem",
      "kind": "type",
      "definition": "{\n  function: string;\n  total: number;\n}"
    },
    {
      "name": "UsageStatistic",
      "kind": "type",
      "definition": "{\n\ttotal: number;\n\tdaily: UsageDailyStatsItem[];\n\tfunctions: number;\n}"
    },
    {
      "name": "UsageStatisticKey",
      "kind": "type",
      "definition": "\"title\""
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface UsageService {
  recordUsage(events: UsageEventInput[]): Promise<any>;
  listUsage(params: UsageListParams): Promise<PaginatedResult<UsageEvent>>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectUsage(filter?: FilterObject): Promise<SelectionStats>;
  getUsageTotal(params?: UsageStatsParams): Promise<UsageTotalStats>;
  getUsageDaily(params?: UsageStatsParams): Promise<UsageDailyStatsItem[]>;
  getUsageByFunction(params?: UsageStatsParams): Promise<UsageFunctionStatsItem[]>;
  getStatistic(keys?: UsageStatisticKey[]): Promise<UsageStatistic>;
}

// Client interface
export interface UsageServiceClient {
  recordUsage(events: UsageEventInput[]): Promise<any>;
  listUsage(params: UsageListParams): Promise<PaginatedResult<UsageEvent>>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectUsage(filter?: FilterObject): Promise<SelectionStats>;
  getUsageTotal(params?: UsageStatsParams): Promise<UsageTotalStats>;
  getUsageDaily(params?: UsageStatsParams): Promise<UsageDailyStatsItem[]>;
  getUsageByFunction(params?: UsageStatsParams): Promise<UsageFunctionStatsItem[]>;
  getStatistic(keys?: UsageStatisticKey[]): Promise<UsageStatistic>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createUsageServiceClient(
  config: CrullerTransportClientConfig,
): UsageServiceClient {
  return createCrullerTransportClient<UsageServiceClient>(metadata, config);
}

export function createUsageServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): UsageServiceClient {
  return createUsageServiceClient(config);
}
