// Auto-generated package
import { createHttpClient } from "nrpc";

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

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export type TelemetryStatistic = {
  totalHot: number;
  totalCold: number;
  byDevice: Record<string, number>;
  byParam: Record<string, number>;
};

export const metadata = {
  "interfaceName": "TelemetryService",
  "serviceName": "telemetry",
  "filePath": "../types/telemetry.ts",
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
          "type": "TelemetryQueryParams",
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
      "returnType": "TelemetryStatistic",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "TelemetryEvent",
      "definition": "{\n  ts: number;\n  device_id: string;\n  param: string;\n  value: number;\n  unit: string;\n}"
    },
    {
      "name": "TelemetryEventInput",
      "definition": "{\n  ts?: number;\n  device_id: string;\n  param: string;\n  value: number;\n  unit?: string;\n}"
    },
    {
      "name": "TelemetryQueryParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  device_id?: string;\n  param?: string;\n  from_ts?: number;\n  to_ts?: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "TelemetryStatistic",
      "definition": "{\n  totalHot: number;\n  totalCold: number;\n  byDevice: Record<string, number>;\n  byParam: Record<string, number>;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface TelemetryService {
  write(event: TelemetryEventInput): Promise<void>;
  listHot(params: TelemetryQueryParams): Promise<PaginatedResult>;
  listCold(params: TelemetryQueryParams): Promise<PaginatedResult>;
  getStatistic(): Promise<TelemetryStatistic>;
}

// Client interface
export interface TelemetryServiceClient {
  write(event: TelemetryEventInput): Promise<void>;
  listHot(params: TelemetryQueryParams): Promise<PaginatedResult>;
  listCold(params: TelemetryQueryParams): Promise<PaginatedResult>;
  getStatistic(): Promise<TelemetryStatistic>;
}

// Factory function
export function createTelemetryServiceClient(
  config?: { baseUrl?: string },
): TelemetryServiceClient {
  return createHttpClient<TelemetryServiceClient>(metadata, config);
}

// Ready-to-use client
export const telemetryClient = createTelemetryServiceClient();
