// Auto-generated package
import { createHttpClient } from "nrpc";

export type ExecutionStatus = "running" | "done" | "failed";

export type TaskState = "queued" | "processing" | "done" | "failed";

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type PaginatedResult<T> = {
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

export type ResumableExecution = {
  id: string;
  workflowName: string;
  params: Record<string, any>;
};

export type CachedNodeResult = {
  hit: boolean;
  result?: any;
};

export type TaskTicket = {
  id: number;
  createdAt: number;
};

export const metadata = {
  "interfaceName": "DagService",
  "serviceName": "dag",
  "filePath": "services/automation/dag.ts",
  "methods": [
    {
      "name": "openExecution",
      "parameters": [
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
          "name": "params",
          "type": "Record<string, any>",
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
      "name": "setExecutionStatus",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "status",
          "type": "ExecutionStatus",
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
      "name": "listResumableExecutions",
      "parameters": [
        {
          "name": "limit",
          "type": "number",
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
      "name": "getCachedNodeResult",
      "parameters": [
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
        }
      ],
      "returnType": "CachedNodeResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createTask",
      "parameters": [
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
        }
      ],
      "returnType": "TaskTicket",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "setTaskProcessing",
      "parameters": [
        {
          "name": "taskId",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "startedAt",
          "type": "number",
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
      "name": "setTaskDone",
      "parameters": [
        {
          "name": "taskId",
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
          "name": "completedAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "result",
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
      "name": "setTaskFailed",
      "parameters": [
        {
          "name": "taskId",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "completedAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "errorMessage",
          "type": "string",
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
      "returnType": "PaginatedResult<Execution>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listTasks",
      "parameters": [
        {
          "name": "executionId",
          "type": "string | any",
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
      "returnType": "PaginatedResult<Task>",
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
      "kind": "type",
      "definition": "\"running\" | \"done\" | \"failed\""
    },
    {
      "name": "TaskState",
      "kind": "type",
      "definition": "\"queued\" | \"processing\" | \"done\" | \"failed\""
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "Execution",
      "kind": "type",
      "definition": "{\n  id: string;\n  workflowName: string;\n  status: ExecutionStatus;\n  startedAt: number;\n  updatedAt: number;\n  createdAt: number;\n}"
    },
    {
      "name": "Task",
      "kind": "type",
      "definition": "{\n  id: number;\n  executionId: string;\n  nodeId: string;\n  state: TaskState;\n  startedAt: number | null;\n  completedAt: number | null;\n  errorMessage: string | null;\n  retryCount: number;\n  createdAt: number;\n  data?: any;\n  result?: any;\n}"
    },
    {
      "name": "ExecutionEventType",
      "kind": "type",
      "definition": "\"started\" | \"task_update\" | \"completed\" | \"failed\""
    },
    {
      "name": "ExecutionEvent",
      "kind": "type",
      "definition": "{\n  type: ExecutionEventType;\n  executionId: string;\n  task?: Task;\n  error?: string;\n}"
    },
    {
      "name": "ExecutionResult",
      "kind": "type",
      "definition": "{\n  id: string;\n}"
    },
    {
      "name": "ResumeExecutionsResult",
      "kind": "type",
      "definition": "{\n  resumed: number;\n  skipped: number;\n  failed: number;\n  ids: string[];\n}"
    },
    {
      "name": "ResumableExecution",
      "kind": "type",
      "definition": "{\n  id: string;\n  workflowName: string;\n  params: Record<string, any>;\n}"
    },
    {
      "name": "CachedNodeResult",
      "kind": "type",
      "definition": "{\n  hit: boolean;\n  result?: any;\n}"
    },
    {
      "name": "TaskTicket",
      "kind": "type",
      "definition": "{\n  id: number;\n  createdAt: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface DagService {
  openExecution(id: string, workflowName: string, params: Record<string, any>): Promise<void>;
  setExecutionStatus(id: string, status: ExecutionStatus): Promise<void>;
  listResumableExecutions(limit?: number): Promise<any>;
  getCachedNodeResult(executionId: string, nodeId: string): Promise<CachedNodeResult>;
  createTask(executionId: string, nodeId: string): Promise<TaskTicket>;
  setTaskProcessing(taskId: number, startedAt: number): Promise<void>;
  setTaskDone(taskId: number, executionId: string, nodeId: string, completedAt: number, result: any): Promise<void>;
  setTaskFailed(taskId: number, completedAt: number, errorMessage: string): Promise<void>;
  statusExecution(id: string): Promise<any>;
  listExecutions(params: PaginationParams): Promise<PaginatedResult<Execution>>;
  listTasks(executionId: string | any, params: PaginationParams): Promise<PaginatedResult<Task>>;
  stats(): Promise<any>;
  listVars(): Promise<any>;
  setVar(key: string, value: any): Promise<void>;
  deleteVar(key: string): Promise<void>;
}

// Client interface
export interface DagServiceClient {
  openExecution(id: string, workflowName: string, params: Record<string, any>): Promise<void>;
  setExecutionStatus(id: string, status: ExecutionStatus): Promise<void>;
  listResumableExecutions(limit?: number): Promise<any>;
  getCachedNodeResult(executionId: string, nodeId: string): Promise<CachedNodeResult>;
  createTask(executionId: string, nodeId: string): Promise<TaskTicket>;
  setTaskProcessing(taskId: number, startedAt: number): Promise<void>;
  setTaskDone(taskId: number, executionId: string, nodeId: string, completedAt: number, result: any): Promise<void>;
  setTaskFailed(taskId: number, completedAt: number, errorMessage: string): Promise<void>;
  statusExecution(id: string): Promise<any>;
  listExecutions(params: PaginationParams): Promise<PaginatedResult<Execution>>;
  listTasks(executionId: string | any, params: PaginationParams): Promise<PaginatedResult<Task>>;
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
