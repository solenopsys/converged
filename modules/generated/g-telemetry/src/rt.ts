// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type TelemetryEvent = {
  ts: number;
  device_id: string;
  param: string;
  value: number;
  unit: string;
};

export type TelemetryEventInput = {
  ts?: number;
  device_id: string;
  param: string;
  value: number;
  unit?: string;
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

export type TelemetryQueryParams = {
  offset: number;
  limit: number;
  device_id?: string;
  param?: string;
  from_ts?: number;
  to_ts?: number;
  filter?: FilterObject;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export type TelemetryStatistic = {
  totalHot: number;
  totalCold: number;
  byDevice: Record<string, number>;
  byParam: Record<string, number>;
};

const metadata: ServiceMetadata = {
  "interfaceName": "TelemetryService",
  "serviceName": "telemetry",
  "filePath": "analytics/telemetry.ts",
  "methods": [
    {
      "name": "write",
      "parameters": [
        {
          "name": "event",
          "type": "TelemetryEventInput",
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
          "type": "TelemetryQueryParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<TelemetryEvent>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listCold",
      "parameters": [
        {
          "name": "params",
          "type": "TelemetryQueryParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<TelemetryEvent>",
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
      "name": "inspectTelemetry",
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
      "parameters": [],
      "returnType": "TelemetryStatistic",
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
      "name": "TelemetryEvent",
      "kind": "type",
      "definition": "{\n  ts: number;\n  device_id: string;\n  param: string;\n  value: number;\n  unit: string;\n}"
    },
    {
      "name": "TelemetryEventInput",
      "kind": "type",
      "definition": "{\n  ts?: number;\n  device_id: string;\n  param: string;\n  value: number;\n  unit?: string;\n}"
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
      "name": "TelemetryQueryParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  device_id?: string;\n  param?: string;\n  from_ts?: number;\n  to_ts?: number;\n  filter?: FilterObject;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "TelemetryStatistic",
      "kind": "type",
      "definition": "{\n  totalHot: number;\n  totalCold: number;\n  byDevice: Record<string, number>;\n  byParam: Record<string, number>;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface TelemetryServiceRtClient {
  write(event: TelemetryEventInput): void;
  listHot(params: TelemetryQueryParams): PaginatedResult<TelemetryEvent>;
  listCold(params: TelemetryQueryParams): PaginatedResult<TelemetryEvent>;
  describeSelection(objectType: string): SelectionDescriptor;
  inspectTelemetry(filter?: FilterObject): SelectionStats;
  getStatistic(): TelemetryStatistic;
  archiveHotToCold(): number;
}

export function createTelemetryServiceRtClient(): TelemetryServiceRtClient {
  return createRtClient<TelemetryServiceRtClient>(metadata);
}
