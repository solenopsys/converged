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

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

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
          "type": "TelemetryQueryParams",
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
          "type": "TelemetryQueryParams",
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
      "name": "TelemetryStatistic",
      "definition": "{\n  totalHot: number;\n  totalCold: number;\n  byDevice: Record<string, number>;\n  byParam: Record<string, number>;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface TelemetryService {
  write(event: TelemetryEventInput): Promise<any>;
  listHot(params: TelemetryQueryParams): Promise<any>;
  listCold(params: TelemetryQueryParams): Promise<any>;
  getStatistic(): Promise<any>;
}

// Client interface
export interface TelemetryServiceClient {
  write(event: TelemetryEventInput): Promise<any>;
  listHot(params: TelemetryQueryParams): Promise<any>;
  listCold(params: TelemetryQueryParams): Promise<any>;
  getStatistic(): Promise<any>;
}

// Factory function
export function createTelemetryServiceClient(
  config?: { baseUrl?: string },
): TelemetryServiceClient {
  return createHttpClient<TelemetryServiceClient>(metadata, config);
}

// Ready-to-use client
export const telemetryClient = createTelemetryServiceClient();
