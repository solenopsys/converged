// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type ProviderParam = {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
};

export type WebhookVerification = "none" | "secret" | "hmac";

export type ProviderDefinition = {
  code: string;
  title?: string;
  params?: ProviderParam[];
  /** What a new endpoint of this provider defaults to. */
  verify?: WebhookVerification;
};

export type WebhookEndpoint = {
  id: string;
  /** Last path segment of the public URL: `/webhooks/<slug>`. */
  slug: string;
  name: string;
  provider: string;
  /** Topic published on arrival. Defaults to `webhook.<provider>.<slug>`. */
  topic?: string;
  verify: WebhookVerification;
  params?: Record<string, any>;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type WebhookResolution = {
  id: string;
  slug: string;
  provider: string;
  topic: string;
  verify: WebhookVerification;
  secret?: string;
  enabled: boolean;
};

export type WebhookDelivery = {
  endpointId: string;
  provider: string;
  method: string;
  path: string;
  headers?: Record<string, any>;
  body?: string;
  ip?: string;
  status?: number;
  error?: string;
};

export type WebhookEndpointInput = {
  name: string;
  provider: string;
  /** Generated from the name when omitted. */
  slug?: string;
  topic?: string;
  verify?: WebhookVerification;
  params?: Record<string, any>;
  enabled?: boolean;
};

export type WebhookEndpointUpdate = {
  name?: string;
  provider?: string;
  slug?: string;
  topic?: string;
  verify?: WebhookVerification;
  params?: Record<string, any>;
  enabled?: boolean;
};

export type WebhookEndpointListParams = {
  offset: number;
  limit: number;
  provider?: string;
  enabled?: boolean;
  filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;

export type SelectionFieldDescriptor = { id: string; label: string; valueType: "string" | "number" | "boolean" | "date" | "enum"; operators: string[] };

export type SelectionDescriptor = { objectType: string; title: string; fields: SelectionFieldDescriptor[]; filterExample?: FilterObject; revision?: string };

export type SelectionStats = { totalCount: number };

export type WebhookLogEntry = {
  id: number;
  endpointId: string;
  provider: string;
  method: string;
  path: string;
  headers?: Record<string, any>;
  body?: string;
  ip?: string;
  status?: number;
  error?: string;
  createdAt: string;
};

export type WebhookLogListParams = {
  offset: number;
  limit: number;
  endpointId?: string;
  provider?: string;
  filter?: FilterObject;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "WebhooksService",
  "serviceName": "webhooks",
  "filePath": "automation/webhooks.ts",
  "methods": [
    {
      "name": "listProviders",
      "parameters": [],
      "returnType": "ProviderDefinition",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "resolveEndpoint",
      "parameters": [
        {
          "name": "slug",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "WebhookResolution | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "recordDelivery",
      "parameters": [
        {
          "name": "delivery",
          "type": "WebhookDelivery",
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
      "name": "createEndpoint",
      "parameters": [
        {
          "name": "input",
          "type": "WebhookEndpointInput",
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
      "name": "updateEndpoint",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "updates",
          "type": "WebhookEndpointUpdate",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "WebhookEndpoint | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteEndpoint",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getEndpoint",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "WebhookEndpoint | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listEndpoints",
      "parameters": [
        {
          "name": "params",
          "type": "WebhookEndpointListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<WebhookEndpoint>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listLogs",
      "parameters": [
        {
          "name": "params",
          "type": "WebhookLogListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<WebhookLogEntry>",
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
      "name": "inspectEndpoints",
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
      "name": "inspectLogs",
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
    }
  ],
  "types": [
    {
      "name": "ProviderParam",
      "kind": "type",
      "definition": "{\n  name: string;\n  type: string;\n  required?: boolean;\n  description?: string;\n}"
    },
    {
      "name": "WebhookVerification",
      "kind": "type",
      "definition": "\"none\" | \"secret\" | \"hmac\""
    },
    {
      "name": "ProviderDefinition",
      "kind": "type",
      "definition": "{\n  code: string;\n  title?: string;\n  params?: ProviderParam[];\n  /** What a new endpoint of this provider defaults to. */\n  verify?: WebhookVerification;\n}"
    },
    {
      "name": "WebhookEndpoint",
      "kind": "type",
      "definition": "{\n  id: string;\n  /** Last path segment of the public URL: `/webhooks/<slug>`. */\n  slug: string;\n  name: string;\n  provider: string;\n  /** Topic published on arrival. Defaults to `webhook.<provider>.<slug>`. */\n  topic?: string;\n  verify: WebhookVerification;\n  params?: Record<string, any>;\n  enabled: boolean;\n  createdAt: string;\n  updatedAt?: string;\n}"
    },
    {
      "name": "WebhookResolution",
      "kind": "type",
      "definition": "{\n  id: string;\n  slug: string;\n  provider: string;\n  topic: string;\n  verify: WebhookVerification;\n  secret?: string;\n  enabled: boolean;\n}"
    },
    {
      "name": "WebhookDelivery",
      "kind": "type",
      "definition": "{\n  endpointId: string;\n  provider: string;\n  method: string;\n  path: string;\n  headers?: Record<string, any>;\n  body?: string;\n  ip?: string;\n  status?: number;\n  error?: string;\n}"
    },
    {
      "name": "WebhookEndpointInput",
      "kind": "type",
      "definition": "{\n  name: string;\n  provider: string;\n  /** Generated from the name when omitted. */\n  slug?: string;\n  topic?: string;\n  verify?: WebhookVerification;\n  params?: Record<string, any>;\n  enabled?: boolean;\n}"
    },
    {
      "name": "WebhookEndpointUpdate",
      "kind": "type",
      "definition": "{\n  name?: string;\n  provider?: string;\n  slug?: string;\n  topic?: string;\n  verify?: WebhookVerification;\n  params?: Record<string, any>;\n  enabled?: boolean;\n}"
    },
    {
      "name": "WebhookEndpointListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  provider?: string;\n  enabled?: boolean;\n  filter?: FilterObject;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "SelectionFieldDescriptor",
      "kind": "type",
      "definition": "{ id: string; label: string; valueType: \"string\" | \"number\" | \"boolean\" | \"date\" | \"enum\"; operators: string[] }"
    },
    {
      "name": "SelectionDescriptor",
      "kind": "type",
      "definition": "{ objectType: string; title: string; fields: SelectionFieldDescriptor[]; filterExample?: FilterObject; revision?: string }"
    },
    {
      "name": "SelectionStats",
      "kind": "type",
      "definition": "{ totalCount: number }"
    },
    {
      "name": "WebhookLogEntry",
      "kind": "type",
      "definition": "{\n  id: number;\n  endpointId: string;\n  provider: string;\n  method: string;\n  path: string;\n  headers?: Record<string, any>;\n  body?: string;\n  ip?: string;\n  status?: number;\n  error?: string;\n  createdAt: string;\n}"
    },
    {
      "name": "WebhookLogListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  endpointId?: string;\n  provider?: string;\n  filter?: FilterObject;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface WebhooksServiceRtClient {
  listProviders(): ProviderDefinition[];
  resolveEndpoint(slug: string): WebhookResolution | any;
  recordDelivery(delivery: WebhookDelivery): void;
  createEndpoint(input: WebhookEndpointInput): any;
  updateEndpoint(id: string, updates: WebhookEndpointUpdate): WebhookEndpoint | any;
  deleteEndpoint(id: string): boolean;
  getEndpoint(id: string): WebhookEndpoint | any;
  listEndpoints(params: WebhookEndpointListParams): PaginatedResult<WebhookEndpoint>;
  listLogs(params: WebhookLogListParams): PaginatedResult<WebhookLogEntry>;
  describeSelection(objectType: string): SelectionDescriptor;
  inspectEndpoints(filter?: FilterObject): SelectionStats;
  inspectLogs(filter?: FilterObject): SelectionStats;
}

export function createWebhooksServiceRtClient(): WebhooksServiceRtClient {
  return createRtClient<WebhooksServiceRtClient>(metadata);
}
