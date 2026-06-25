// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

export type PaginatedResult<T> = {
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

const metadata: ServiceMetadata = {
  "interfaceName": "LogsService",
  "serviceName": "logs",
  "filePath": "services/analytics/logs.ts",
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
      "returnType": "PaginatedResult<LogEvent>",
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
      "returnType": "PaginatedResult<LogEvent>",
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
      "kind": "type",
      "definition": "{\n  ts: number;\n  source: string;\n  level: number;\n  code: number;\n  message: string;\n}"
    },
    {
      "name": "LogEventInput",
      "kind": "type",
      "definition": "{\n  ts?: number;\n  source: string;\n  level: number;\n  code: number;\n  message: string;\n}"
    },
    {
      "name": "LogQueryParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  source?: string;\n  level?: number;\n  code?: number;\n  from_ts?: number;\n  to_ts?: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "LogsStatistic",
      "kind": "type",
      "definition": "{\n  totalHot: number;\n  totalCold: number;\n  byLevel: Record<number, number>;\n  bySource: Record<string, number>;\n  errors: number;\n  warnings: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface LogsServiceRtClient {
  write(event: LogEventInput): void;
  listHot(params: LogQueryParams): PaginatedResult<LogEvent>;
  listCold(params: LogQueryParams): PaginatedResult<LogEvent>;
  getStatistic(): LogsStatistic;
  archiveHotToCold(): number;
}

export function createLogsServiceRtClient(): LogsServiceRtClient {
  return createRtClient<LogsServiceRtClient>(metadata);
}
