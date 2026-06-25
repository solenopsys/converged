// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type ContextName = string;

export type ContextLanguage = string;

export type Context = {
  name: ContextName;
  language: ContextLanguage;
  /** Prompt text (voice/chat) or a structured payload — consumer-defined. */
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
  /** Filter to a single language when set. */
  language?: ContextLanguage;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "ContextsService",
  "serviceName": "contexts",
  "filePath": "services/ai/contexts.ts",
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
      "definition": "{\n  name: ContextName;\n  language: ContextLanguage;\n  /** Prompt text (voice/chat) or a structured payload — consumer-defined. */\n  data: unknown;\n  updatedAt: number;\n}"
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
      "definition": "{\n  offset?: number;\n  limit?: number;\n  /** Filter to a single language when set. */\n  language?: ContextLanguage;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface ContextsServiceRtClient {
  saveContext(input: ContextInput): ContextSummary;
  getContext(name: ContextName, language?: ContextLanguage): Context | any;
  listContexts(params: ContextListParams): PaginatedResult<ContextSummary>;
  deleteContext(name: ContextName, language?: ContextLanguage): boolean;
}

export function createContextsServiceRtClient(): ContextsServiceRtClient {
  return createRtClient<ContextsServiceRtClient>(metadata);
}
