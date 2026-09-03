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

export type LogQueryParams = {
  offset: number;
  limit: number;
  source?: string;
  level?: number;
  code?: number;
  from_ts?: number;
  to_ts?: number;
  filter?: FilterObject;
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

export type LogsStatisticKey = "title";

const metadata: ServiceMetadata = {
  "interfaceName": "LogsService",
  "serviceName": "logs",
  "filePath": "analytics/logs.ts",
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
      "name": "inspectLogs",
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
      "name": "getStatistic",
      "parameters": [
        {
          "name": "keys",
          "type": "LogsStatisticKey",
          "optional": true,
          "isArray": true
        }
      ],
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
      "name": "LogQueryParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  source?: string;\n  level?: number;\n  code?: number;\n  from_ts?: number;\n  to_ts?: number;\n  filter?: FilterObject;\n}"
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
    },
    {
      "name": "LogsStatisticKey",
      "kind": "type",
      "definition": "\"title\""
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface LogsServiceRtClient {
  write(event: LogEventInput): void;
  listHot(params: LogQueryParams): PaginatedResult<LogEvent>;
  listCold(params: LogQueryParams): PaginatedResult<LogEvent>;
  describeSelection(objectType: string): SelectionDescriptor;
  inspectLogs(filter?: FilterObject): SelectionStats;
  getStatistic(keys?: LogsStatisticKey[]): LogsStatistic;
  archiveHotToCold(): number;
}

export function createLogsServiceRtClient(): LogsServiceRtClient {
  return createRtClient<LogsServiceRtClient>(metadata);
}
