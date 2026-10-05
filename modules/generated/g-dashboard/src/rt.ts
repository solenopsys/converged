// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type DashboardPinId = string;

export type ISODateString = string;

export type DashboardIndicatorPin = {
	id: DashboardPinId;
	widgetId: string;
	title?: string;
	source?: string;
	componentKey?: string;
	position: number;
	createdAt: ISODateString;
	updatedAt: ISODateString;
};

export type DashboardIndicatorPinInput = {
	widgetId: string;
	title?: string;
	source?: string;
	componentKey?: string;
	position?: number;
};

export type DashboardChartCache = {
	key: string;
	data: unknown;
	updatedAt: string;
};

const metadata: ServiceMetadata = {
  "interfaceName": "DashboardService",
  "serviceName": "dashboard",
  "filePath": "analytics/dashboard.ts",
  "methods": [
    {
      "name": "pinIndicator",
      "parameters": [
        {
          "name": "input",
          "type": "DashboardIndicatorPinInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "DashboardIndicatorPin",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "unpinIndicator",
      "parameters": [
        {
          "name": "widgetId",
          "type": "string",
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
      "name": "listIndicators",
      "parameters": [],
      "returnType": "DashboardIndicatorPin",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "clearIndicators",
      "parameters": [],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getChartCache",
      "parameters": [
        {
          "name": "key",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "DashboardChartCache | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "setChartCache",
      "parameters": [
        {
          "name": "key",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "data",
          "type": "unknown",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "DashboardPinId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "DashboardIndicatorPin",
      "kind": "type",
      "definition": "{\n\tid: DashboardPinId;\n\twidgetId: string;\n\ttitle?: string;\n\tsource?: string;\n\tcomponentKey?: string;\n\tposition: number;\n\tcreatedAt: ISODateString;\n\tupdatedAt: ISODateString;\n}"
    },
    {
      "name": "DashboardIndicatorPinInput",
      "kind": "type",
      "definition": "{\n\twidgetId: string;\n\ttitle?: string;\n\tsource?: string;\n\tcomponentKey?: string;\n\tposition?: number;\n}"
    },
    {
      "name": "DashboardChartCache",
      "kind": "type",
      "definition": "{\n\tkey: string;\n\tdata: unknown;\n\tupdatedAt: string;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface DashboardServiceRtClient {
  pinIndicator(input: DashboardIndicatorPinInput): DashboardIndicatorPin;
  unpinIndicator(widgetId: string): void;
  listIndicators(): DashboardIndicatorPin[];
  clearIndicators(): void;
  getChartCache(key: string): DashboardChartCache | any;
  setChartCache(key: string, data: unknown): void;
}

export function createDashboardServiceRtClient(): DashboardServiceRtClient {
  return createRtClient<DashboardServiceRtClient>(metadata);
}
