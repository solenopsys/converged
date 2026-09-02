// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type ExecutionStatus = "running" | "done" | "failed";

export type TaskState = "queued" | "processing" | "done" | "failed";

export type PaginationParams = {
	offset: number;
	limit: number;
	filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;

export type SelectionFieldDescriptor = {
	id: string;
	label: string;
	valueType: "string" | "number" | "boolean" | "date" | "enum";
	operators: string[];
};

export type SelectionDescriptor = {
	objectType: string;
	title: string;
	fields: SelectionFieldDescriptor[];
	filterExample?: FilterObject;
	revision?: string;
};

export type SelectionStats = { totalCount: number };

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

export type ExecutionEventType = | "started"
	| "task_update"
	| "completed"
	| "failed";

export type ExecutionEvent = {
	type: ExecutionEventType;
	executionId: string;
	task?: Task;
	error?: string;
};

export type ExecutionResult = {
	id: string;
};

export type AvailableWorkflow = {
	id: string;
	name: string;
	script: string;
	brief?: string;
	description?: string;
	parameters?: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
	/** Internal Ptah-proxy URL for the runtime; UI clients must ignore it. */
	sourceUrl?: string;
};

export type DagVariable = { key: string; value: unknown };

export type ResumeExecutionsResult = {
	resumed: number;
	skipped: number;
	failed: number;
	ids: string[];
};

export type TaskTicket = {
	id: number;
	createdAt: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "DagService",
  "serviceName": "dag",
  "filePath": "automation/dag.ts",
  "methods": [
    {
      "name": "listAvailableWorkflows",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listWorkflows",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<AvailableWorkflow>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
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
      "name": "listVariables",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<DagVariable>",
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
      "name": "inspectSelection",
      "parameters": [
        {
          "name": "objectType",
          "type": "string",
          "optional": false,
          "isArray": false
        },
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
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\tfilter?: FilterObject;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "SelectionFieldDescriptor",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tlabel: string;\n\tvalueType: \"string\" | \"number\" | \"boolean\" | \"date\" | \"enum\";\n\toperators: string[];\n}"
    },
    {
      "name": "SelectionDescriptor",
      "kind": "type",
      "definition": "{\n\tobjectType: string;\n\ttitle: string;\n\tfields: SelectionFieldDescriptor[];\n\tfilterExample?: FilterObject;\n\trevision?: string;\n}"
    },
    {
      "name": "SelectionStats",
      "kind": "type",
      "definition": "{ totalCount: number }"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    },
    {
      "name": "Execution",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tworkflowName: string;\n\tstatus: ExecutionStatus;\n\tstartedAt: number;\n\tupdatedAt: number;\n\tcreatedAt: number;\n}"
    },
    {
      "name": "Task",
      "kind": "type",
      "definition": "{\n\tid: number;\n\texecutionId: string;\n\tnodeId: string;\n\tstate: TaskState;\n\tstartedAt: number | null;\n\tcompletedAt: number | null;\n\terrorMessage: string | null;\n\tretryCount: number;\n\tcreatedAt: number;\n\tdata?: any;\n\tresult?: any;\n}"
    },
    {
      "name": "ExecutionEventType",
      "kind": "type",
      "definition": "| \"started\"\n\t| \"task_update\"\n\t| \"completed\"\n\t| \"failed\""
    },
    {
      "name": "ExecutionEvent",
      "kind": "type",
      "definition": "{\n\ttype: ExecutionEventType;\n\texecutionId: string;\n\ttask?: Task;\n\terror?: string;\n}"
    },
    {
      "name": "ExecutionResult",
      "kind": "type",
      "definition": "{\n\tid: string;\n}"
    },
    {
      "name": "AvailableWorkflow",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tname: string;\n\tscript: string;\n\tbrief?: string;\n\tdescription?: string;\n\tparameters?: {\n\t\ttype: \"object\";\n\t\tproperties: Record<string, unknown>;\n\t\trequired?: string[];\n\t};\n\t/** Internal Ptah-proxy URL for the runtime; UI clients must ignore it. */\n\tsourceUrl?: string;\n}"
    },
    {
      "name": "DagVariable",
      "kind": "type",
      "definition": "{ key: string; value: unknown }"
    },
    {
      "name": "ResumeExecutionsResult",
      "kind": "type",
      "definition": "{\n\tresumed: number;\n\tskipped: number;\n\tfailed: number;\n\tids: string[];\n}"
    },
    {
      "name": "TaskTicket",
      "kind": "type",
      "definition": "{\n\tid: number;\n\tcreatedAt: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface DagServiceRtClient {
  listAvailableWorkflows(): any;
  listWorkflows(params: PaginationParams): PaginatedResult<AvailableWorkflow>;
  openExecution(id: string, workflowName: string, params: Record<string, any>): void;
  setExecutionStatus(id: string, status: ExecutionStatus): void;
  createTask(executionId: string, nodeId: string): TaskTicket;
  setTaskDone(taskId: number, executionId: string, nodeId: string, completedAt: number, result: any): void;
  setTaskFailed(taskId: number, completedAt: number, errorMessage: string): void;
  statusExecution(id: string): any;
  listExecutions(params: PaginationParams): PaginatedResult<Execution>;
  listTasks(executionId: string | any, params: PaginationParams): PaginatedResult<Task>;
  stats(): any;
  listVars(): any;
  listVariables(params: PaginationParams): PaginatedResult<DagVariable>;
  setVar(key: string, value: any): void;
  deleteVar(key: string): void;
  describeSelection(objectType: string): SelectionDescriptor;
  inspectSelection(objectType: string, filter?: FilterObject): SelectionStats;
}

export function createDagServiceRtClient(): DagServiceRtClient {
  return createRtClient<DagServiceRtClient>(metadata);
}
