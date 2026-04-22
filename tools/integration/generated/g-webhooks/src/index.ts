// Auto-generated package
import { createHttpClient } from "nrpc";

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
};

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
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "WebhooksService",
  "serviceName": "webhooks",
  "filePath": "services/automation/webhooks.ts",
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
      "definition": "{\n  offset: number;\n  limit: number;\n  provider?: string;\n  enabled?: boolean;\n}"
    },
    {
      "name": "WebhookLogEntry",
      "kind": "type",
      "definition": "{\n  id: number;\n  endpointId: string;\n  provider: string;\n  method: string;\n  path: string;\n  headers?: Record<string, any>;\n  body?: string;\n  ip?: string;\n  status?: number;\n  error?: string;\n  createdAt: string;\n}"
    },
    {
      "name": "WebhookLogListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  endpointId?: string;\n  provider?: string;\n}"
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
}

// Factory function
export function createWebhooksServiceClient(
  config?: { baseUrl?: string },
): WebhooksServiceClient {
  return createHttpClient<WebhooksServiceClient>(metadata, config);
}

// Ready-to-use client
export const webhooksClient = createWebhooksServiceClient();
