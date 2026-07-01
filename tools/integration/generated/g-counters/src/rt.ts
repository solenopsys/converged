// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
  "interfaceName": "CountersService",
  "serviceName": "counters",
  "filePath": "services/analytics/counters.ts",
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
      "definition": "| \"google-analytics\" // GA4, gtag.js  (trackingId = \"G-XXXXXXXX\")\n  | \"google-tag-manager\" // GTM         (trackingId = \"GTM-XXXXXXX\")\n  | \"yandex-metrika\" // Yandex.Metrika  (trackingId = numeric id)\n  | \"facebook-pixel\" // Meta Pixel      (trackingId = numeric id)\n  | \"custom\""
    },
    {
      "name": "Counter",
      "kind": "type",
      "definition": "{\n  id: string; // stable key, e.g. \"google-analytics\"\n  type: CounterType;\n  trackingId?: string; // measurement / container / pixel id\n  enabled: boolean;\n  headSnippet?: string; // used when type === \"custom\": raw <script> for <head>\n  createdAt?: string;\n  updatedAt?: string;\n}"
    },
    {
      "name": "CounterInput",
      "kind": "type",
      "definition": "{\n  id: string;\n  type: CounterType;\n  trackingId?: string;\n  enabled?: boolean; // defaults to true on create\n  headSnippet?: string;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface CountersServiceRtClient {
  listCounters(): Counter[];
  listEnabled(): Counter[];
  getCounter(id: string): Counter | any;
  upsertCounter(input: CounterInput): Counter;
  deleteCounter(id: string): void;
}

export function createCountersServiceRtClient(): CountersServiceRtClient {
  return createRtClient<CountersServiceRtClient>(metadata);
}
