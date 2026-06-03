// Auto-generated package
import { createHttpClient } from "nrpc";

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

export const metadata = {
  "interfaceName": "DashboardService",
  "serviceName": "dashboard",
  "filePath": "services/analytics/dashboard.ts",
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
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface DashboardService {
  pinIndicator(input: DashboardIndicatorPinInput): Promise<DashboardIndicatorPin>;
  unpinIndicator(widgetId: string): Promise<void>;
  listIndicators(): Promise<DashboardIndicatorPin[]>;
  clearIndicators(): Promise<void>;
}

// Client interface
export interface DashboardServiceClient {
  pinIndicator(input: DashboardIndicatorPinInput): Promise<DashboardIndicatorPin>;
  unpinIndicator(widgetId: string): Promise<void>;
  listIndicators(): Promise<DashboardIndicatorPin[]>;
  clearIndicators(): Promise<void>;
}

// Factory function
export function createDashboardServiceClient(
  config?: { baseUrl?: string },
): DashboardServiceClient {
  return createHttpClient<DashboardServiceClient>(metadata, config);
}

// Ready-to-use client
export const dashboardClient = createDashboardServiceClient();
