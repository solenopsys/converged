// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type CounterType = | "google-analytics" // GA4, gtag.js  (trackingId = "G-XXXXXXXX")
	| "google-tag-manager" // GTM         (trackingId = "GTM-XXXXXXX")
	| "yandex-metrika" // Yandex.Metrika  (trackingId = numeric id)
	| "facebook-pixel" // Meta Pixel      (trackingId = numeric id)
	| "custom";

export type Counter = {
	id: string; // stable key, e.g. "google-analytics"
	type: CounterType;
	trackingId?: string; // measurement / container / pixel id
	enabled: boolean;
	headSnippet?: string; // used when type === "custom": raw <script> for <head>
	createdAt?: string;
	updatedAt?: string;
};

export type CounterInput = {
	id: string;
	type: CounterType;
	trackingId?: string;
	enabled?: boolean; // defaults to true on create
	headSnippet?: string;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "CountersService",
  "serviceName": "counters",
  "filePath": "analytics/counters.ts",
  "methods": [
    {
      "name": "listCounters",
      "parameters": [],
      "returnType": "Counter",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "listEnabled",
      "parameters": [],
      "returnType": "Counter",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getCounter",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Counter | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "upsertCounter",
      "parameters": [
        {
          "name": "input",
          "type": "CounterInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Counter",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteCounter",
      "parameters": [
        {
          "name": "id",
          "type": "string",
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
      "name": "CounterType",
      "kind": "type",
      "definition": "| \"google-analytics\" // GA4, gtag.js  (trackingId = \"G-XXXXXXXX\")\n\t| \"google-tag-manager\" // GTM         (trackingId = \"GTM-XXXXXXX\")\n\t| \"yandex-metrika\" // Yandex.Metrika  (trackingId = numeric id)\n\t| \"facebook-pixel\" // Meta Pixel      (trackingId = numeric id)\n\t| \"custom\""
    },
    {
      "name": "Counter",
      "kind": "type",
      "definition": "{\n\tid: string; // stable key, e.g. \"google-analytics\"\n\ttype: CounterType;\n\ttrackingId?: string; // measurement / container / pixel id\n\tenabled: boolean;\n\theadSnippet?: string; // used when type === \"custom\": raw <script> for <head>\n\tcreatedAt?: string;\n\tupdatedAt?: string;\n}"
    },
    {
      "name": "CounterInput",
      "kind": "type",
      "definition": "{\n\tid: string;\n\ttype: CounterType;\n\ttrackingId?: string;\n\tenabled?: boolean; // defaults to true on create\n\theadSnippet?: string;\n}"
    }
  ]
};

// Client interface
export interface CountersServiceClient {
  listCounters(): Promise<Counter[]>;
  listEnabled(): Promise<Counter[]>;
  getCounter(id: string): Promise<Counter | any>;
  upsertCounter(input: CounterInput): Promise<Counter>;
  deleteCounter(id: string): Promise<void>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createCountersServiceClient(
  config: WebSocketClientConfig,
): CountersServiceClient {
  return createWebSocketClient<CountersServiceClient>(metadata, config);
}

export function createCountersServiceWebSocketClient(
  config: WebSocketClientConfig,
): CountersServiceClient {
  return createCountersServiceClient(config);
}
