// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

export type UsageListParams = {
  offset: number;
  limit: number;
  function?: string;
  user?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type UsageStatsParams = {
  function?: string;
  user?: string;
  dateFrom?: string;
  dateTo?: string;
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

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "UsageService",
  "serviceName": "usage",
  "filePath": "services/analytics/usage.ts",
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
      "name": "UsageListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  function?: string;\n  user?: string;\n  dateFrom?: string;\n  dateTo?: string;\n}"
    },
    {
      "name": "UsageStatsParams",
      "kind": "type",
      "definition": "{\n  function?: string;\n  user?: string;\n  dateFrom?: string;\n  dateTo?: string;\n}"
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
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface UsageServiceRtClient {
  recordUsage(events: UsageEventInput[]): any;
  listUsage(params: UsageListParams): PaginatedResult<UsageEvent>;
  getUsageTotal(params?: UsageStatsParams): UsageTotalStats;
  getUsageDaily(params?: UsageStatsParams): UsageDailyStatsItem[];
  getUsageByFunction(params?: UsageStatsParams): UsageFunctionStatsItem[];
}

export function createUsageServiceRtClient(): UsageServiceRtClient {
  return createRtClient<UsageServiceRtClient>(metadata);
}
