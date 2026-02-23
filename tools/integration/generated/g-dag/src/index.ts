// Auto-generated package
import { createHttpClient } from "nrpc";

export type ExecutionStatus = "running" | "done" | "failed";

export type TaskState = "queued" | "processing" | "done" | "failed";

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export interface Execution {
  id: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: number;
  updatedAt: number;
  createdAt: number;
}

export interface Task {
  id: number;
  executionId: string;
  nodeId: string;
  state: TaskState;
  startedAt: any;
  completedAt: any;
  errorMessage: any;
  retryCount: number;
  createdAt: number;
  data?: any;
  result?: any;
}

export type ExecutionEventType = "started" | "task_update" | "completed" | "failed";

export interface ExecutionEvent {
  type: ExecutionEventType;
  executionId: string;
  task?: Task;
  error?: string;
}

export const metadata = {
  "interfaceName": "DagService",
  "serviceName": "dag",
  "filePath": "../types/dag.ts",
  "methods": [
    {
      "name": "startExecution",
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
      "isAsyncIterable": true
    },
    {
      "name": "createExecution",
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
      "name": "statusExecution",
      "parameters": [
        {
          "name": "id",
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
      "name": "listExecutions",
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
      "name": "listTasks",
      "parameters": [
        {
          "name": "executionId",
          "type": "any",
          "optional": false,
          "isArray": false
        },
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
      "name": "stats",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listWorkflows",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listVars",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "setVar",
      "parameters": [
        {
          "name": "key",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "value",
          "type": "any",
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
      "name": "deleteVar",
      "parameters": [
        {
          "name": "key",
          "type": "string",
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
      "name": "ExecutionStatus",
      "definition": "\"running\" | \"done\" | \"failed\""
    },
    {
      "name": "TaskState",
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
      "name": "Execution",
      "definition": "",
      "properties": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "workflowName",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "status",
          "type": "ExecutionStatus",
          "optional": false,
          "isArray": false
        },
        {
          "name": "startedAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "updatedAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "createdAt",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "Task",
      "definition": "",
      "properties": [
        {
          "name": "id",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "executionId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "nodeId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "state",
          "type": "TaskState",
          "optional": false,
          "isArray": false
        },
        {
          "name": "startedAt",
          "type": "any",
          "optional": false,
          "isArray": false
        },
        {
          "name": "completedAt",
          "type": "any",
          "optional": false,
          "isArray": false
        },
        {
          "name": "errorMessage",
          "type": "any",
          "optional": false,
          "isArray": false
        },
        {
          "name": "retryCount",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "createdAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "data",
          "type": "any",
          "optional": true,
          "isArray": false
        },
        {
          "name": "result",
          "type": "any",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "ExecutionEventType",
      "definition": "\"started\" | \"task_update\" | \"completed\" | \"failed\""
    },
    {
      "name": "ExecutionEvent",
      "definition": "",
      "properties": [
        {
          "name": "type",
          "type": "ExecutionEventType",
          "optional": false,
          "isArray": false
        },
        {
          "name": "executionId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "task",
          "type": "Task",
          "optional": true,
          "isArray": false
        },
        {
          "name": "error",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface DagService {
  startExecution(workflowName: string, params: Record): AsyncIterable<any>;
  createExecution(workflowName: string, params: Record): Promise<any>;
  statusExecution(id: string): Promise<any>;
  listExecutions(params: PaginationParams): Promise<any>;
  listTasks(executionId: any, params: PaginationParams): Promise<any>;
  stats(): Promise<any>;
  listWorkflows(): Promise<any>;
  listVars(): Promise<any>;
  setVar(key: string, value: any): Promise<any>;
  deleteVar(key: string): Promise<any>;
}

// Client interface
export interface DagServiceClient {
  startExecution(workflowName: string, params: Record): AsyncIterable<any>;
  createExecution(workflowName: string, params: Record): Promise<any>;
  statusExecution(id: string): Promise<any>;
  listExecutions(params: PaginationParams): Promise<any>;
  listTasks(executionId: any, params: PaginationParams): Promise<any>;
  stats(): Promise<any>;
  listWorkflows(): Promise<any>;
  listVars(): Promise<any>;
  setVar(key: string, value: any): Promise<any>;
  deleteVar(key: string): Promise<any>;
}

// Factory function
export function createDagServiceClient(
  config?: { baseUrl?: string },
): DagServiceClient {
  return createHttpClient<DagServiceClient>(metadata, config);
}

// Ready-to-use client
export const dagClient = createDagServiceClient();
