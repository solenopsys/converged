// Auto-generated package
import { createHttpClient } from "nrpc";

export type ExecutionStatus = "running" | "done" | "failed";

export type TaskState = "queued" | "processing" | "done" | "failed";

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
  "interfaceName": "RuntimeDagService",
  "serviceName": "dag",
  "packageName": "g-rt-dag",
  "filePath": "runtime/automation/dag.ts",
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
          "type": "Record<string, any>",
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
          "type": "Record<string, any>",
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
      "name": "listWorkflows",
      "parameters": [],
      "returnType": "any",
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
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface RuntimeDagService {
  startExecution(workflowName: string, params: Record<string, any>): AsyncIterable<ExecutionEvent>;
  createExecution(workflowName: string, params: Record<string, any>): Promise<ExecutionResult>;
  resumeActiveExecutions(limit?: number): Promise<ResumeExecutionsResult>;
  listWorkflows(): Promise<any>;
}

// Client interface
export interface RuntimeDagServiceClient {
  startExecution(workflowName: string, params: Record<string, any>): AsyncIterable<ExecutionEvent>;
  createExecution(workflowName: string, params: Record<string, any>): Promise<ExecutionResult>;
  resumeActiveExecutions(limit?: number): Promise<ResumeExecutionsResult>;
  listWorkflows(): Promise<any>;
}

// Factory function
export function createRuntimeDagServiceClient(
  config?: { baseUrl?: string },
): RuntimeDagServiceClient {
  return createHttpClient<RuntimeDagServiceClient>(metadata, config);
}

// Ready-to-use client
export const dagClient = createRuntimeDagServiceClient();
