// Auto-generated package
import { createHttpClient } from "nrpc";

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

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export const metadata = {
  "interfaceName": "UsageService",
  "serviceName": "usage",
  "filePath": "../types/usage.ts",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "UsageEventInput",
      "definition": "{\n  function: string;\n  user: string;\n  date?: string;\n}"
    },
    {
      "name": "UsageEvent",
      "definition": "{\n  id: string;\n  function: string;\n  user: string;\n  date: string;\n  createdAt?: string;\n}"
    },
    {
      "name": "UsageListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  function?: string;\n  user?: string;\n  dateFrom?: string;\n  dateTo?: string;\n}"
    },
    {
      "name": "UsageStatsParams",
      "definition": "{\n  function?: string;\n  user?: string;\n  dateFrom?: string;\n  dateTo?: string;\n}"
    },
    {
      "name": "UsageTotalStats",
      "definition": "{\n  total: number;\n}"
    },
    {
      "name": "UsageDailyStatsItem",
      "definition": "{\n  date: string;\n  total: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "",
      "properties": [
        {
          "name": "items",
          "type": "T",
          "optional": false,
          "isArray": true
        },
        {
          "name": "totalCount",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface UsageService {
  recordUsage(events: UsageEventInput[]): Promise<any>;
  listUsage(params: UsageListParams): Promise<any>;
  getUsageTotal(params?: UsageStatsParams): Promise<any>;
  getUsageDaily(params?: UsageStatsParams): Promise<any>;
}

// Client interface
export interface UsageServiceClient {
  recordUsage(events: UsageEventInput[]): Promise<any>;
  listUsage(params: UsageListParams): Promise<any>;
  getUsageTotal(params?: UsageStatsParams): Promise<any>;
  getUsageDaily(params?: UsageStatsParams): Promise<any>;
}

// Factory function
export function createUsageServiceClient(
  config?: { baseUrl?: string },
): UsageServiceClient {
  return createHttpClient<UsageServiceClient>(metadata, config);
}

// Ready-to-use client
export const usageClient = createUsageServiceClient();
