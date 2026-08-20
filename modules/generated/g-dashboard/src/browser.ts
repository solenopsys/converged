// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

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

export const metadata: ServiceMetadata = {
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

// Client interface
export interface DashboardServiceClient {
  pinIndicator(input: DashboardIndicatorPinInput): Promise<DashboardIndicatorPin>;
  unpinIndicator(widgetId: string): Promise<void>;
  listIndicators(): Promise<DashboardIndicatorPin[]>;
  clearIndicators(): Promise<void>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createDashboardServiceClient(
  config: WebSocketClientConfig,
): DashboardServiceClient {
  return createWebSocketClient<DashboardServiceClient>(metadata, config);
}

export function createDashboardServiceWebSocketClient(
  config: WebSocketClientConfig,
): DashboardServiceClient {
  return createDashboardServiceClient(config);
}
