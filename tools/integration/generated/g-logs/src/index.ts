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

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

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
      "returnType": "void",
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
      "returnType": "PaginatedResult",
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
      "returnType": "PaginatedResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getStatistic",
      "parameters": [],
      "returnType": "LogsStatistic",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "archiveHotToCold",
      "parameters": [],
      "returnType": "number",
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
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "LogsStatistic",
      "definition": "{\n  totalHot: number;\n  totalCold: number;\n  byLevel: Record<number, number>;\n  bySource: Record<string, number>;\n  errors: number;\n  warnings: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface LogsService {
  write(event: LogEventInput): Promise<void>;
  listHot(params: LogQueryParams): Promise<PaginatedResult>;
  listCold(params: LogQueryParams): Promise<PaginatedResult>;
  getStatistic(): Promise<LogsStatistic>;
  archiveHotToCold(): Promise<number>;
}

// Client interface
export interface LogsServiceClient {
  write(event: LogEventInput): Promise<void>;
  listHot(params: LogQueryParams): Promise<PaginatedResult>;
  listCold(params: LogQueryParams): Promise<PaginatedResult>;
  getStatistic(): Promise<LogsStatistic>;
  archiveHotToCold(): Promise<number>;
}

// Factory function
export function createLogsServiceClient(
  config?: { baseUrl?: string },
): LogsServiceClient {
  return createHttpClient<LogsServiceClient>(metadata, config);
}

// Ready-to-use client
export const logsClient = createLogsServiceClient();
