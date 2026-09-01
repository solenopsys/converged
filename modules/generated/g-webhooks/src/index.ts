// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type ProviderParam = {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
};

export type ProviderDefinition = {
  code: string;
  title?: string;
  params?: ProviderParam[];
};

export type WebhookEndpoint = {
  id: string;
  name: string;
  provider: string;
  params?: Record<string, any>;
  enabled: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type WebhookEndpointInput = {
  name: string;
  provider: string;
  params?: Record<string, any>;
  enabled?: boolean;
};

export type WebhookEndpointUpdate = {
  name?: string;
  provider?: string;
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

export const metadata: ServiceMetadata = {
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
      "name": "ProviderDefinition",
      "kind": "type",
      "definition": "{\n  code: string;\n  title?: string;\n  params?: ProviderParam[];\n}"
    },
    {
      "name": "WebhookEndpoint",
      "kind": "type",
      "definition": "{\n  id: string;\n  name: string;\n  provider: string;\n  params?: Record<string, any>;\n  enabled: boolean;\n  createdAt: string;\n  updatedAt?: string;\n}"
    },
    {
      "name": "WebhookEndpointInput",
      "kind": "type",
      "definition": "{\n  name: string;\n  provider: string;\n  params?: Record<string, any>;\n  enabled?: boolean;\n}"
    },
    {
      "name": "WebhookEndpointUpdate",
      "kind": "type",
      "definition": "{\n  name?: string;\n  provider?: string;\n  params?: Record<string, any>;\n  enabled?: boolean;\n}"
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

// Server interface (to be implemented in microservice)
export interface WebhooksService {
  listProviders(): Promise<ProviderDefinition[]>;
  createEndpoint(input: WebhookEndpointInput): Promise<any>;
  updateEndpoint(id: string, updates: WebhookEndpointUpdate): Promise<WebhookEndpoint | any>;
  deleteEndpoint(id: string): Promise<boolean>;
  getEndpoint(id: string): Promise<WebhookEndpoint | any>;
  listEndpoints(params: WebhookEndpointListParams): Promise<PaginatedResult<WebhookEndpoint>>;
  listLogs(params: WebhookLogListParams): Promise<PaginatedResult<WebhookLogEntry>>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectEndpoints(filter?: FilterObject): Promise<SelectionStats>;
  inspectLogs(filter?: FilterObject): Promise<SelectionStats>;
}

// Client interface
export interface WebhooksServiceClient {
  listProviders(): Promise<ProviderDefinition[]>;
  createEndpoint(input: WebhookEndpointInput): Promise<any>;
  updateEndpoint(id: string, updates: WebhookEndpointUpdate): Promise<WebhookEndpoint | any>;
  deleteEndpoint(id: string): Promise<boolean>;
  getEndpoint(id: string): Promise<WebhookEndpoint | any>;
  listEndpoints(params: WebhookEndpointListParams): Promise<PaginatedResult<WebhookEndpoint>>;
  listLogs(params: WebhookLogListParams): Promise<PaginatedResult<WebhookLogEntry>>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectEndpoints(filter?: FilterObject): Promise<SelectionStats>;
  inspectLogs(filter?: FilterObject): Promise<SelectionStats>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createWebhooksServiceClient(
  config: CrullerTransportClientConfig,
): WebhooksServiceClient {
  return createCrullerTransportClient<WebhooksServiceClient>(metadata, config);
}

export function createWebhooksServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): WebhooksServiceClient {
  return createWebhooksServiceClient(config);
}
