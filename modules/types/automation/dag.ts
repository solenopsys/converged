/**
 * The DAG service owns two things and nothing else:
 *
 * 1. The triggers — "when this bus topic appears, run that workflow".
 * 2. The execution log — a tree of what a run actually did.
 *
 * The workflow catalogue is not its own: Ptah puts the active Solution's
 * descriptors into this service's environment and it republishes them. It
 * executes nothing. Centimanus reads the catalogue and the triggers, runs the
 * JavaScript, and reports back here while the script runs.
 */

export type ExecutionStatus = "running" | "done" | "failed";
export type NodeState = "running" | "done" | "failed";

/** `node` is `rt.node`/`rt.attempt`; `sub` is a delegation to another workflow. */
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

// ---- catalogue -------------------------------------------------------------

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

// ---- triggers --------------------------------------------------------------

/**
 * "When this topic appears on the bus, run that workflow."
 *
 * Triggers are system configuration: tens of rows, held whole in the runtime's
 * memory, matched against an arriving event by a loop rather than a query.
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

// ---- execution log ---------------------------------------------------------

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

/**
 * One node of a run, as the runtime reported it.
 *
 * `input` is what the node was asked to do: for a plain node, the array of
 * service calls it made — `rt.node(name, fn)` takes a closure, so the calls are
 * the only input there is — and for a `sub`, the parameters the child got.
 */
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

/**
 * A cache entry the runtime wrote for a run. `commitLog` moves it into the
 * store verbatim, so this is the shape that ends up there.
 */
export type ExecutionLogEntry = Execution;

/**
 * One row of the flattened tree. Depth-first, a parent immediately before the
 * nodes of the run it delegated to, so a client renders the tree by indenting
 * `depth` and nothing else.
 */
export type ExecutionTreeRow = ExecutionNode & {
	depth: number;
	/** The run this node belongs to — the root's id, or a delegated child's. */
	executionId: string;
};

export type ExecutionTree = {
	execution: Execution;
	rows: ExecutionTreeRow[];
	/** Every run in the tree, the root first, for headers and timings. */
	executions: Execution[];
};

/**
 * The result of committing a batch of log entries.
 *
 * `committed` is what actually landed. A key the runtime asked for but that is
 * missing from the answer is one whose cache entry had already expired or was
 * never written — the runtime drops it rather than retrying forever.
 */
export type LogCommitResult = {
	committed: string[];
	failed: string[];
};

// ---- variables -------------------------------------------------------------

export type DagVariable = { key: string; value: unknown };

// ---- statistics ------------------------------------------------------------

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

export interface DagService {
	// ---- catalogue, republished from the Solution's environment ----
	listAvailableWorkflows(): Promise<{ items: AvailableWorkflow[] }>;
	listWorkflows(
		params: PaginationParams,
	): Promise<PaginatedResult<AvailableWorkflow>>;

	// ---- triggers ----
	listTriggers(
		params: PaginationParams,
	): Promise<PaginatedResult<WorkflowTrigger>>;
	/** Enabled triggers only, for the runtime's own cache. */
	activeTriggers(): Promise<{ items: WorkflowTrigger[] }>;
	createTrigger(input: WorkflowTriggerInput): Promise<{ id: string }>;
	updateTrigger(
		id: string,
		updates: WorkflowTriggerUpdate,
	): Promise<WorkflowTrigger | null>;
	deleteTrigger(id: string): Promise<boolean>;

	// ---- execution log ----
	/**
	 * Commit log entries the runtime has already written to the cache.
	 *
	 * The runtime writes each entry to Valkey under a key it composes itself and
	 * then hands over the keys — never the entries. Storage reads the cache and
	 * writes the store directly, so a run's log costs the transport a few keys
	 * per batch instead of two round trips per node.
	 *
	 * Keys are `dag:log:<executionId>:exec` for a run and
	 * `dag:log:<executionId>:n:<seq>` for one of its nodes. They are derived
	 * from the run and the node's sequence, so re-committing one is a rewrite
	 * rather than a duplicate — which is what makes recovery after a crash safe
	 * to repeat.
	 */
	commitLog(keys: string[]): Promise<LogCommitResult>;

	// ---- reading ----
	listExecutions(params: PaginationParams): Promise<PaginatedResult<Execution>>;
	/** One run and everything under it, flattened depth-first. */
	executionTree(id: string): Promise<ExecutionTree>;
	stats(): Promise<DagStats>;

	// ---- variables ----
	listVariables(params: PaginationParams): Promise<PaginatedResult<DagVariable>>;
	setVar(key: string, value: any): Promise<void>;
	deleteVar(key: string): Promise<void>;

	describeSelection(objectType: string): Promise<SelectionDescriptor>;
	inspectSelection(
		objectType: string,
		filter?: FilterObject,
	): Promise<SelectionStats>;
}
