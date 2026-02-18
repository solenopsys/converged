// Auto-generated package
import { createHttpClient } from "nrpc";

export type ContextStatus = "running" | "done" | "failed";

export type MessageStatus = "queued" | "processing" | "done" | "failed";

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export type ContextInfo = {
  id: string;
  workflowName: string;
  status: ContextStatus;
  startedAt: string;
  updatedAt: string;
};

export type NodeState = "queued" | "processing" | "done" | "failed";

export type NodeExecution = {
  id: number;
  processId: string;
  nodeId: string;
  state: NodeState;
  startedAt: string;
  completedAt: string;
  errorMessage: string;
  retryCount: number;
  createdAt: string;
};

export const metadata = {
  "interfaceName": "DagService",
  "serviceName": "dag",
  "filePath": "../types/dag.ts",
  "methods": [
    {
      "name": "status",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createContext",
      "parameters": [
        {
          "name": "workflowName",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "Record",
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
      "name": "emit",
      "parameters": [
        {
          "name": "contextId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "event",
          "type": "string",
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
      "name": "getContext",
      "parameters": [
        {
          "name": "contextId",
          "type": "string",
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
      "name": "listContexts",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
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
      "name": "getStats",
      "parameters": [
        {
          "name": "workflowName",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getNodeProcessorStats",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listNodes",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ContextStatus",
      "definition": "\"running\" | \"done\" | \"failed\""
    },
    {
      "name": "MessageStatus",
      "definition": "\"queued\" | \"processing\" | \"done\" | \"failed\""
    },
    {
      "name": "PaginationParams",
      "definition": "",
      "properties": [
        {
          "name": "offset",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "limit",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "PaginatedResult",
      "definition": "",
      "properties": [
        {
          "name": "items",
          "type": "T",
          "optional": false,
          "isArray": true
        },
        {
          "name": "totalCount",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "ContextInfo",
      "definition": "{\n  id: string;\n  workflowName: string;\n  status: ContextStatus;\n  startedAt: string;\n  updatedAt: string;\n}"
    },
    {
      "name": "NodeState",
      "definition": "\"queued\" | \"processing\" | \"done\" | \"failed\""
    },
    {
      "name": "NodeExecution",
      "definition": "{\n  id: number;\n  processId: string;\n  nodeId: string;\n  state: NodeState;\n  startedAt: string;\n  completedAt: string;\n  errorMessage: string;\n  retryCount: number;\n  createdAt: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface DagService {
  status(): Promise<any>;
  createContext(workflowName: string, params: Record): Promise<any>;
  emit(contextId: string, event: string): Promise<any>;
  getContext(contextId: string): Promise<any>;
  listContexts(params: PaginationParams): Promise<any>;
  getStats(workflowName?: string): Promise<any>;
  getNodeProcessorStats(): Promise<any>;
  listNodes(params: PaginationParams): Promise<any>;
}

// Client interface
export interface DagServiceClient {
  status(): Promise<any>;
  createContext(workflowName: string, params: Record): Promise<any>;
  emit(contextId: string, event: string): Promise<any>;
  getContext(contextId: string): Promise<any>;
  listContexts(params: PaginationParams): Promise<any>;
  getStats(workflowName?: string): Promise<any>;
  getNodeProcessorStats(): Promise<any>;
  listNodes(params: PaginationParams): Promise<any>;
}

// Factory function
export function createDagServiceClient(
  config?: { baseUrl?: string },
): DagServiceClient {
  return createHttpClient<DagServiceClient>(metadata, config);
}

// Ready-to-use client
export const dagClient = createDagServiceClient();
