// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type ExecutionStatus = "running" | "done" | "failed";

export type NodeState = "running" | "done" | "failed";

export type NodeKind = "node" | "sub";

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

export type WorkflowTrigger = {
	id: string;
	name: string;
	/** Bus topic pattern: `*` is one segment, `>` is the tail. */
	topic: string;
	/** Workflow script path, exactly as `listAvailableWorkflows` reports it. */
	script: string;
	/** Merged under the event when the workflow starts. */
	params?: Record<string, unknown>;
	enabled: boolean;
	createdAt: string;
	updatedAt?: string;
};

export type WorkflowTriggerInput = {
	name: string;
	topic: string;
	script: string;
	params?: Record<string, unknown>;
	enabled?: boolean;
};

export type WorkflowTriggerUpdate = {
	name?: string;
	topic?: string;
	script?: string;
	params?: Record<string, unknown>;
	enabled?: boolean;
};

export type Execution = {
	id: string;
	workflow: string;
	status: ExecutionStatus;
	params?: any;
	startedAt: number;
	endedAt: number | null;
	error?: string;
	/** Set when `rt.sub` in another run opened this one. */
	parentExecutionId?: string;
	/** The node in the parent run that delegated here. */
	parentNode?: string;
};

export type ExecutionNode = {
	/** Order of opening within the run. Monotonic, assigned by this service. */
	seq: number;
	node: string;
	kind: NodeKind;
	state: NodeState;
	startedAt: number;
	endedAt: number | null;
	input?: any;
	result?: any;
	error?: string;
	/** Set on a `sub` node: the run the delegation opened. */
	childExecutionId?: string;
};

export type ExecutionLogEntry = Execution;

export type ExecutionTreeRow = ExecutionNode & {
	depth: number;
	/** The run this node belongs to — the root's id, or a delegated child's. */
	executionId: string;
};

export type CacheRef = {
	cacheKey: string;
	sizeBytes: number;
};

export type ExecutionTree = {
	execution: Execution;
	rows: ExecutionTreeRow[];
	/** Every run in the tree, the root first, for headers and timings. */
	executions: Execution[];
};

export type LogCommitResult = {
	committed: string[];
	failed: string[];
};

export type DagStatsPoint = {
	date: string;
	total: number;
	done: number;
	failed: number;
};

export type DagStats = {
	executions: {
		total: number;
		running: number;
		done: number;
		failed: number;
	};
	daily: DagStatsPoint[];
	byWorkflow: Record<string, number>;
};

export const metadata: ServiceMetadata = {
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
      "name": "listTriggers",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<WorkflowTrigger>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "activeTriggers",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createTrigger",
      "parameters": [
        {
          "name": "input",
          "type": "WorkflowTriggerInput",
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
      "name": "updateTrigger",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "updates",
          "type": "WorkflowTriggerUpdate",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "WorkflowTrigger | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteTrigger",
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
      "name": "commitLog",
      "parameters": [
        {
          "name": "keys",
          "type": "string",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "LogCommitResult",
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
      "name": "executionTree",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CacheRef",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "stats",
      "parameters": [],
      "returnType": "DagStats",
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
      "name": "NodeState",
      "kind": "type",
      "definition": "\"running\" | \"done\" | \"failed\""
    },
    {
      "name": "NodeKind",
      "kind": "type",
      "definition": "\"node\" | \"sub\""
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
      "name": "AvailableWorkflow",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tname: string;\n\tscript: string;\n\tbrief?: string;\n\tdescription?: string;\n\tparameters?: {\n\t\ttype: \"object\";\n\t\tproperties: Record<string, unknown>;\n\t\trequired?: string[];\n\t};\n\t/** Internal Ptah-proxy URL for the runtime; UI clients must ignore it. */\n\tsourceUrl?: string;\n}"
    },
    {
      "name": "WorkflowTrigger",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tname: string;\n\t/** Bus topic pattern: `*` is one segment, `>` is the tail. */\n\ttopic: string;\n\t/** Workflow script path, exactly as `listAvailableWorkflows` reports it. */\n\tscript: string;\n\t/** Merged under the event when the workflow starts. */\n\tparams?: Record<string, unknown>;\n\tenabled: boolean;\n\tcreatedAt: string;\n\tupdatedAt?: string;\n}"
    },
    {
      "name": "WorkflowTriggerInput",
      "kind": "type",
      "definition": "{\n\tname: string;\n\ttopic: string;\n\tscript: string;\n\tparams?: Record<string, unknown>;\n\tenabled?: boolean;\n}"
    },
    {
      "name": "WorkflowTriggerUpdate",
      "kind": "type",
      "definition": "{\n\tname?: string;\n\ttopic?: string;\n\tscript?: string;\n\tparams?: Record<string, unknown>;\n\tenabled?: boolean;\n}"
    },
    {
      "name": "Execution",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tworkflow: string;\n\tstatus: ExecutionStatus;\n\tparams?: any;\n\tstartedAt: number;\n\tendedAt: number | null;\n\terror?: string;\n\t/** Set when `rt.sub` in another run opened this one. */\n\tparentExecutionId?: string;\n\t/** The node in the parent run that delegated here. */\n\tparentNode?: string;\n}"
    },
    {
      "name": "ExecutionNode",
      "kind": "type",
      "definition": "{\n\t/** Order of opening within the run. Monotonic, assigned by this service. */\n\tseq: number;\n\tnode: string;\n\tkind: NodeKind;\n\tstate: NodeState;\n\tstartedAt: number;\n\tendedAt: number | null;\n\tinput?: any;\n\tresult?: any;\n\terror?: string;\n\t/** Set on a `sub` node: the run the delegation opened. */\n\tchildExecutionId?: string;\n}"
    },
    {
      "name": "ExecutionLogEntry",
      "kind": "type",
      "definition": "Execution"
    },
    {
      "name": "ExecutionTreeRow",
      "kind": "type",
      "definition": "ExecutionNode & {\n\tdepth: number;\n\t/** The run this node belongs to — the root's id, or a delegated child's. */\n\texecutionId: string;\n}"
    },
    {
      "name": "CacheRef",
      "kind": "type",
      "definition": "{\n\tcacheKey: string;\n\tsizeBytes: number;\n}"
    },
    {
      "name": "ExecutionTree",
      "kind": "type",
      "definition": "{\n\texecution: Execution;\n\trows: ExecutionTreeRow[];\n\t/** Every run in the tree, the root first, for headers and timings. */\n\texecutions: Execution[];\n}"
    },
    {
      "name": "LogCommitResult",
      "kind": "type",
      "definition": "{\n\tcommitted: string[];\n\tfailed: string[];\n}"
    },
    {
      "name": "DagStatsPoint",
      "kind": "type",
      "definition": "{\n\tdate: string;\n\ttotal: number;\n\tdone: number;\n\tfailed: number;\n}"
    },
    {
      "name": "DagStats",
      "kind": "type",
      "definition": "{\n\texecutions: {\n\t\ttotal: number;\n\t\trunning: number;\n\t\tdone: number;\n\t\tfailed: number;\n\t};\n\tdaily: DagStatsPoint[];\n\tbyWorkflow: Record<string, number>;\n}"
    }
  ]
};

// Client interface
export interface DagServiceClient {
  listAvailableWorkflows(): Promise<any>;
  listWorkflows(params: PaginationParams): Promise<PaginatedResult<AvailableWorkflow>>;
  listTriggers(params: PaginationParams): Promise<PaginatedResult<WorkflowTrigger>>;
  activeTriggers(): Promise<any>;
  createTrigger(input: WorkflowTriggerInput): Promise<any>;
  updateTrigger(id: string, updates: WorkflowTriggerUpdate): Promise<WorkflowTrigger | any>;
  deleteTrigger(id: string): Promise<boolean>;
  commitLog(keys: string[]): Promise<LogCommitResult>;
  listExecutions(params: PaginationParams): Promise<PaginatedResult<Execution>>;
  executionTree(id: string): Promise<CacheRef>;
  stats(): Promise<DagStats>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectSelection(objectType: string, filter?: FilterObject): Promise<SelectionStats>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createDagServiceClient(
  config: WebSocketClientConfig,
): DagServiceClient {
  return createWebSocketClient<DagServiceClient>(metadata, config);
}

export function createDagServiceWebSocketClient(
  config: WebSocketClientConfig,
): DagServiceClient {
  return createDagServiceClient(config);
}
