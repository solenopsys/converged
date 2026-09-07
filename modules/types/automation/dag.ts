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

export type ExecutionEventType =
	| "started"
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

/** A Solution-selected workflow. Source bytes remain behind Ptah-proxy. */
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

/**
 * "When this topic appears on the bus, run that workflow."
 *
 * The topic is a bus pattern, so `order.paid.>` follows every order and
 * `order.paid.42` follows one. Triggers are system configuration: there are
 * tens of them, the runtime holds the whole set in memory and matches an
 * arriving event against it without touching storage.
 */
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

export interface DagService {
	listAvailableWorkflows(): Promise<{ items: AvailableWorkflow[] }>;
	createTrigger(input: WorkflowTriggerInput): Promise<{ id: string }>;
	updateTrigger(
		id: string,
		updates: WorkflowTriggerUpdate,
	): Promise<WorkflowTrigger | null>;
	deleteTrigger(id: string): Promise<boolean>;
	listTriggers(params: PaginationParams): Promise<PaginatedResult<WorkflowTrigger>>;
	/** Enabled triggers only, for the workflow runtime's own cache. */
	activeTriggers(): Promise<{ items: WorkflowTrigger[] }>;
	listWorkflows(params: PaginationParams): Promise<PaginatedResult<AvailableWorkflow>>;
	openExecution(
		id: string,
		workflowName: string,
		params: Record<string, any>,
	): Promise<void>;
	setExecutionStatus(id: string, status: ExecutionStatus): Promise<void>;
	/** `startedAt` and `input` are what the runtime observed when the node
	 *  opened: the wall clock, and the service calls the node went on to make.
	 *  Both are optional so an older caller keeps working. */
	createTask(
		executionId: string,
		nodeId: string,
		startedAt?: number,
		input?: any,
	): Promise<TaskTicket>;
	setTaskDone(
		taskId: number,
		executionId: string,
		nodeId: string,
		completedAt: number,
		result: any,
	): Promise<void>;
	/** `executionId` and `nodeId` let a failed node keep its record, so the UI
	 *  can still show what it was asked to do. */
	setTaskFailed(
		taskId: number,
		completedAt: number,
		errorMessage: string,
		executionId?: string,
		nodeId?: string,
	): Promise<void>;

	statusExecution(id: string): Promise<{
		execution: Execution;
		tasks: Task[];
	}>;

	listExecutions(params: PaginationParams): Promise<PaginatedResult<Execution>>;

	listTasks(
		executionId: string | null,
		params: PaginationParams,
	): Promise<PaginatedResult<Task>>;

	stats(): Promise<{
		executions: {
			total: number;
			running: number;
			done: number;
			failed: number;
		};
		tasks: {
			total: number;
			queued: number;
			processing: number;
			done: number;
			failed: number;
		};
	}>;

	listVars(): Promise<{ items: { key: string; value: any }[] }>;
	listVariables(params: PaginationParams): Promise<PaginatedResult<DagVariable>>;
	setVar(key: string, value: any): Promise<void>;
	deleteVar(key: string): Promise<void>;
	describeSelection(objectType: string): Promise<SelectionDescriptor>;
	inspectSelection(objectType: string, filter?: FilterObject): Promise<SelectionStats>;
}
