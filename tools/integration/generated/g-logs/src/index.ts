// Auto-generated package
import { createHttpClient } from "nrpc";

export type LogEvent = {
  ts: number;
  source: string;
  level: number;
  code: number;
  message: string;
};

export type LogEventInput = {
  ts?: number;
  source: string;
  level: number;
  code: number;
  message: string;
};

export type LogQueryParams = {
  offset: number;
  limit: number;
  source?: string;
  level?: number;
  code?: number;
  from_ts?: number;
  to_ts?: number;
};

export type LogRestoreParams = {
  source?: string;
  level?: number;
  code?: number;
  from_ts?: number;
  to_ts?: number;
  batchSize?: number;
};

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export type LogsStatistic = {
  totalHot: number;
  totalCold: number;
  byLevel: Record<number, number>;
  bySource: Record<string, number>;
  errors: number;
  warnings: number;
};

export const metadata = {
  "interfaceName": "LogsService",
  "serviceName": "logs",
  "filePath": "../types/logs.ts",
  "methods": [
    {
      "name": "write",
      "parameters": [
        {
          "name": "event",
          "type": "LogEventInput",
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
      "name": "listHot",
      "parameters": [
        {
          "name": "params",
          "type": "LogQueryParams",
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
      "name": "listCold",
      "parameters": [
        {
          "name": "params",
          "type": "LogQueryParams",
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
      "name": "flushHot",
      "parameters": [
        {
          "name": "date",
          "type": "string",
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
      "name": "flushOldHot",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "restoreHot",
      "parameters": [
        {
          "name": "params",
          "type": "LogRestoreParams",
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
      "name": "getStatistic",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "LogEvent",
      "definition": "{\n  ts: number;\n  source: string;\n  level: number;\n  code: number;\n  message: string;\n}"
    },
    {
      "name": "LogEventInput",
      "definition": "{\n  ts?: number;\n  source: string;\n  level: number;\n  code: number;\n  message: string;\n}"
    },
    {
      "name": "LogQueryParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  source?: string;\n  level?: number;\n  code?: number;\n  from_ts?: number;\n  to_ts?: number;\n}"
    },
    {
      "name": "LogRestoreParams",
      "definition": "{\n  source?: string;\n  level?: number;\n  code?: number;\n  from_ts?: number;\n  to_ts?: number;\n  batchSize?: number;\n}"
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
    },
    {
      "name": "LogsStatistic",
      "definition": "{\n  totalHot: number;\n  totalCold: number;\n  byLevel: Record<number, number>;\n  bySource: Record<string, number>;\n  errors: number;\n  warnings: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface LogsService {
  write(event: LogEventInput): Promise<any>;
  listHot(params: LogQueryParams): Promise<any>;
  listCold(params: LogQueryParams): Promise<any>;
  flushHot(date?: string): Promise<any>;
  flushOldHot(): Promise<any>;
  restoreHot(params?: LogRestoreParams): Promise<any>;
  getStatistic(): Promise<any>;
}

// Client interface
export interface LogsServiceClient {
  write(event: LogEventInput): Promise<any>;
  listHot(params: LogQueryParams): Promise<any>;
  listCold(params: LogQueryParams): Promise<any>;
  flushHot(date?: string): Promise<any>;
  flushOldHot(): Promise<any>;
  restoreHot(params?: LogRestoreParams): Promise<any>;
  getStatistic(): Promise<any>;
}

// Factory function
export function createLogsServiceClient(
  config?: { baseUrl?: string },
): LogsServiceClient {
  return createHttpClient<LogsServiceClient>(metadata, config);
}

// Ready-to-use client
export const logsClient = createLogsServiceClient();
