// Auto-generated package
import { createHttpClient } from "nrpc";

export type ExecutionStatus = "running" | "done" | "failed";

export type TaskState = "queued" | "processing" | "done" | "failed";

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export type Execution = {
  id: string;
  workflowName: string;
  status: ExecutionStatus;
  startedAt: number;
  updatedAt: number;
  createdAt: number;
};

export type Task = {
  id: number;
  executionId: string;
  nodeId: string;
  state: TaskState;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: number;
  data?: any;
  result?: any;
};

export type ExecutionEventType = "started" | "task_update" | "completed" | "failed";

export type ExecutionEvent = {
  type: ExecutionEventType;
  executionId: string;
  task?: Task;
  error?: string;
};

export type ExecutionResult = {
  id: string;
};

export type ResumeExecutionsResult = {
  resumed: number;
  skipped: number;
  failed: number;
  ids: string[];
};

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
      "returnType": "ExecutionEvent",
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
      "returnType": "ExecutionResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "resumeActiveExecutions",
      "parameters": [
        {
          "name": "limit",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "ResumeExecutionsResult",
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
      "returnType": "PaginatedResult",
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
      "returnType": "PaginatedResult",
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
      "returnType": "void",
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
      "returnType": "void",
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
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "Execution",
      "definition": "{\n  id: string;\n  workflowName: string;\n  status: ExecutionStatus;\n  startedAt: number;\n  updatedAt: number;\n  createdAt: number;\n}"
    },
    {
      "name": "Task",
      "definition": "{\n  id: number;\n  executionId: string;\n  nodeId: string;\n  state: TaskState;\n  startedAt: number | null;\n  completedAt: number | null;\n  errorMessage: string | null;\n  retryCount: number;\n  createdAt: number;\n  data?: any;\n  result?: any;\n}"
    },
    {
      "name": "ExecutionEventType",
      "definition": "\"started\" | \"task_update\" | \"completed\" | \"failed\""
    },
    {
      "name": "ExecutionEvent",
      "definition": "{\n  type: ExecutionEventType;\n  executionId: string;\n  task?: Task;\n  error?: string;\n}"
    },
    {
      "name": "ExecutionResult",
      "definition": "{\n  id: string;\n}"
    },
    {
      "name": "ResumeExecutionsResult",
      "definition": "{\n  resumed: number;\n  skipped: number;\n  failed: number;\n  ids: string[];\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface DagService {
  startExecution(workflowName: string, params: Record): AsyncIterable<ExecutionEvent>;
  createExecution(workflowName: string, params: Record): Promise<ExecutionResult>;
  resumeActiveExecutions(limit?: number): Promise<ResumeExecutionsResult>;
  statusExecution(id: string): Promise<any>;
  listExecutions(params: PaginationParams): Promise<PaginatedResult>;
  listTasks(executionId: any, params: PaginationParams): Promise<PaginatedResult>;
  stats(): Promise<any>;
  listVars(): Promise<any>;
  setVar(key: string, value: any): Promise<void>;
  deleteVar(key: string): Promise<void>;
}

// Client interface
export interface DagServiceClient {
  startExecution(workflowName: string, params: Record): AsyncIterable<ExecutionEvent>;
  createExecution(workflowName: string, params: Record): Promise<ExecutionResult>;
  resumeActiveExecutions(limit?: number): Promise<ResumeExecutionsResult>;
  statusExecution(id: string): Promise<any>;
  listExecutions(params: PaginationParams): Promise<PaginatedResult>;
  listTasks(executionId: any, params: PaginationParams): Promise<PaginatedResult>;
  stats(): Promise<any>;
  listVars(): Promise<any>;
  setVar(key: string, value: any): Promise<void>;
  deleteVar(key: string): Promise<void>;
}

// Factory function
export function createDagServiceClient(
  config?: { baseUrl?: string },
): DagServiceClient {
  return createHttpClient<DagServiceClient>(metadata, config);
}

// Ready-to-use client
export const dagClient = createDagServiceClient();
