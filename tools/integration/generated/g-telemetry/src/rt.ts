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

export type TelemetryQueryParams = {
  offset: number;
  limit: number;
  device_id?: string;
  param?: string;
  from_ts?: number;
  to_ts?: number;
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
  "filePath": "services/analytics/telemetry.ts",
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
      "name": "TelemetryQueryParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  device_id?: string;\n  param?: string;\n  from_ts?: number;\n  to_ts?: number;\n}"
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
  getStatistic(): TelemetryStatistic;
  archiveHotToCold(): number;
}

export function createTelemetryServiceRtClient(): TelemetryServiceRtClient {
  return createRtClient<TelemetryServiceRtClient>(metadata);
}
