// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type ContextName = string;

export type ContextLanguage = string;

export type Context = {
  name: ContextName;
  language: ContextLanguage;

  data: unknown;
  updatedAt: number;
};

export type ContextInput = {
  name: ContextName;
  language: ContextLanguage;
  data: unknown;
};

export type ContextSummary = {
  name: ContextName;
  language: ContextLanguage;
  updatedAt: number;
  size?: number;
};

export type ContextListParams = {
  offset?: number;
  limit?: number;

  language?: ContextLanguage;
  filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;

export type PaginatedResult<T> = {
  items: T[];
  totalCount: number;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "ContextsService",
  "serviceName": "contexts",
  "filePath": "ai/contexts.ts",
  "methods": [
    {
      "name": "saveContext",
      "parameters": [
        {
          "name": "input",
          "type": "ContextInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ContextSummary",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getContext",
      "parameters": [
        {
          "name": "name",
          "type": "ContextName",
          "optional": false,
          "isArray": false
        },
        {
          "name": "language",
          "type": "ContextLanguage",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "Context | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listContexts",
      "parameters": [
        {
          "name": "params",
          "type": "ContextListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<ContextSummary>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteContext",
      "parameters": [
        {
          "name": "name",
          "type": "ContextName",
          "optional": false,
          "isArray": false
        },
        {
          "name": "language",
          "type": "ContextLanguage",
          "optional": true,
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
      "name": "ContextName",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ContextLanguage",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "Context",
      "kind": "type",
      "definition": "{\n  name: ContextName;\n  language: ContextLanguage;\n\n  data: unknown;\n  updatedAt: number;\n}"
    },
    {
      "name": "ContextInput",
      "kind": "type",
      "definition": "{\n  name: ContextName;\n  language: ContextLanguage;\n  data: unknown;\n}"
    },
    {
      "name": "ContextSummary",
      "kind": "type",
      "definition": "{\n  name: ContextName;\n  language: ContextLanguage;\n  updatedAt: number;\n  size?: number;\n}"
    },
    {
      "name": "ContextListParams",
      "kind": "type",
      "definition": "{\n  offset?: number;\n  limit?: number;\n\n  language?: ContextLanguage;\n  filter?: FilterObject;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ContextsService {
  saveContext(input: ContextInput): Promise<ContextSummary>;
  getContext(name: ContextName, language?: ContextLanguage): Promise<Context | any>;
  listContexts(params: ContextListParams): Promise<PaginatedResult<ContextSummary>>;
  deleteContext(name: ContextName, language?: ContextLanguage): Promise<boolean>;
}

// Client interface
export interface ContextsServiceClient {
  saveContext(input: ContextInput): Promise<ContextSummary>;
  getContext(name: ContextName, language?: ContextLanguage): Promise<Context | any>;
  listContexts(params: ContextListParams): Promise<PaginatedResult<ContextSummary>>;
  deleteContext(name: ContextName, language?: ContextLanguage): Promise<boolean>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createContextsServiceClient(
  config: CrullerTransportClientConfig,
): ContextsServiceClient {
  return createCrullerTransportClient<ContextsServiceClient>(metadata, config);
}

export function createContextsServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): ContextsServiceClient {
  return createContextsServiceClient(config);
}
