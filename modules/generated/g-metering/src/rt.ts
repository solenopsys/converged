// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type ISODateString = string;

export type MeterResource = "tokens" | "bytes" | "ms";

export type MeterSampleInput = {
	owner?: string;
	resource: MeterResource;
	amount: number;
	at?: ISODateString;
};

export type MeterDailyItem = {
	date: string;
	owner: string;
	resource: MeterResource;
	amount: number;
};

export type MeterDailyParams = {
	owner?: string;
	from?: ISODateString;
	to?: ISODateString;
};

const metadata: ServiceMetadata = {
  "interfaceName": "MeteringService",
  "serviceName": "metering",
  "filePath": "business/metering.ts",
  "methods": [
    {
      "name": "record",
      "parameters": [
        {
          "name": "samples",
          "type": "MeterSampleInput",
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
      "name": "dailyTotals",
      "parameters": [
        {
          "name": "params",
          "type": "MeterDailyParams",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "MeterDailyItem",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "claimDay",
      "parameters": [
        {
          "name": "date",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "owner",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "resource",
          "type": "MeterResource",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "MeterResource",
      "kind": "type",
      "definition": "\"tokens\" | \"bytes\" | \"ms\""
    },
    {
      "name": "MeterSampleInput",
      "kind": "type",
      "definition": "{\n\towner?: string;\n\tresource: MeterResource;\n\tamount: number;\n\tat?: ISODateString;\n}"
    },
    {
      "name": "MeterDailyItem",
      "kind": "type",
      "definition": "{\n\tdate: string;\n\towner: string;\n\tresource: MeterResource;\n\tamount: number;\n}"
    },
    {
      "name": "MeterDailyParams",
      "kind": "type",
      "definition": "{\n\towner?: string;\n\tfrom?: ISODateString;\n\tto?: ISODateString;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface MeteringServiceRtClient {
  record(samples: MeterSampleInput[]): any;
  dailyTotals(params?: MeterDailyParams): MeterDailyItem[];
  claimDay(date: string, owner: string, resource: MeterResource): boolean;
}

export function createMeteringServiceRtClient(): MeteringServiceRtClient {
  return createRtClient<MeteringServiceRtClient>(metadata);
}
