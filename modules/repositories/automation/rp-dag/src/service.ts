import {
	CACHE_BLOB_TTL_SECONDS,
	type CacheAdapter,
	createJsonFilterAdapter,
	createServerNrpcClientConfig,
} from "back-core";
import { createBusServiceClient } from "g-bus";
import type {
	AvailableWorkflow,
	CacheRef,
	DagService,
	DagStats,
	DagStatsPoint,
	Execution,
	ExecutionStatus,
	ExecutionTree,
	ExecutionTreeRow,
	FilterObject,
	LogCommitResult,
	PaginatedResult,
	PaginationParams,
	SelectionDescriptor,
	SelectionStats,
	WorkflowTrigger,
	WorkflowTriggerInput,
	WorkflowTriggerUpdate,
} from "g-dag";
import { Access } from "nrpc";
import { StoresController } from "./store";
import { SEQ_WIDTH } from "./store/processing";

/**
 * The topic the runtime listens on to learn its trigger set changed. Publishing
 * it is what makes a new trigger take effect at once instead of on the
 * runtime's next scheduled refresh.
 */
const TRIGGERS_CHANGED_TOPIC = "dag.triggers.changed";

/** Prefix of every cache key the runtime is allowed to commit from. */
const LOG_KEY_PREFIX = "dag:log:";

/** How deep `executionTree` follows `rt.sub` before it stops descending. */
const MAX_TREE_DEPTH = 8;

const workflowFilters = createJsonFilterAdapter<AvailableWorkflow>({
	id: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
	name: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
	script: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
});

const executionFilters = createJsonFilterAdapter<Execution>({
	id: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
	workflow: {
		valueType: "string",
		operators: ["eq", "in", "notEq", "notIn", "contains"],
	},
	status: { valueType: "string", operators: ["eq", "in", "notEq", "notIn"] },
	startedAt: {
		valueType: "number",
		operators: ["gt", "gte", "lt", "lte", "between"],
	},
});

const triggerFilters = createJsonFilterAdapter<WorkflowTrigger>({
	id: { valueType: "string", operators: ["eq", "in"] },
	name: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
	topic: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
	script: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith"],
	},
	enabled: { valueType: "boolean", operators: ["eq", "notEq"] },
});

export default class DagServiceImpl implements DagService {
	private stores: StoresController;
	private readonly storesReady: Promise<void>;

	private readonly cache?: CacheAdapter;

	constructor(config?: { cache?: CacheAdapter; valkey?: CacheAdapter }) {
		this.cache = config?.cache ?? config?.valkey;
		this.stores = new StoresController("rp-dag");
		this.storesReady = this.stores.init().catch((error) => {
			console.error("[rp-dag] store init error", error);
			throw error;
		});
	}

	private requiredCache(): CacheAdapter {
		if (!this.cache) {
			throw new Error("rp-dag requires the Valkey cache adapter");
		}
		return this.cache;
	}

	private async ready(): Promise<void> {
		await this.storesReady;
	}

	private get log() {
		return this.stores.processingStoreService;
	}

	private get triggers() {
		return this.stores.triggersStoreService;
	}

	// ---- catalogue -----------------------------------------------------------

	/**
	 * The active Solution's workflow descriptors, as Ptah left them in this
	 * service's environment. Nothing here is stored: the catalogue belongs to
	 * the Solution, and this service only republishes it in the shape the
	 * runtime and the UI read.
	 */
	@Access("public")
	async listAvailableWorkflows(): Promise<{ items: AvailableWorkflow[] }> {
		const raw = process.env.WORKFLOWS ?? "[]";
		const endpoints = parseStringMap(process.env.WORKFLOW_ENDPOINTS);
		const digests = parseStringMap(process.env.WORKFLOW_DIGESTS);
		const proxy = process.env.MODULE_PROXY?.replace(/\/+$/, "");
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			throw new Error("[rp-dag] WORKFLOWS must be valid JSON");
		}
		if (!Array.isArray(parsed))
			throw new Error("[rp-dag] WORKFLOWS must be an array");

		return {
			items: parsed.flatMap((value): AvailableWorkflow[] => {
				if (!value || typeof value !== "object") return [];
				const workflow = value as Record<string, unknown>;
				if (
					typeof workflow.name !== "string" ||
					typeof workflow.script !== "string"
				)
					return [];
				const sourceUrl =
					endpoints[workflow.script] ??
					(proxy && digests[workflow.script]
						? `${proxy}/${digests[workflow.script]}`
						: undefined);
				const parameters = asParameters(workflow.parameters);
				return [
					{
						id: typeof workflow.id === "string" ? workflow.id : workflow.name,
						name: workflow.name,
						script: workflow.script,
						...(typeof workflow.brief === "string"
							? { brief: workflow.brief }
							: {}),
						...(typeof workflow.description === "string"
							? { description: workflow.description }
							: {}),
						...(parameters ? { parameters } : {}),
						...(sourceUrl ? { sourceUrl } : {}),
					},
				];
			}),
		};
	}

	async listWorkflows(
		params: PaginationParams,
	): Promise<PaginatedResult<AvailableWorkflow>> {
		const items = (await this.listAvailableWorkflows()).items.filter(
			workflowFilters.predicate(params.filter),
		);
		return page(items, params);
	}

	// ---- triggers ------------------------------------------------------------

	async createTrigger(input: WorkflowTriggerInput): Promise<{ id: string }> {
		await this.ready();
		if (!input?.name?.trim() || !input?.topic?.trim() || !input?.script?.trim())
			throw badRequest("name, topic and script are required");
		const trigger = await this.triggers.create(input);
		this.announceTriggers();
		return { id: trigger.id };
	}

	async updateTrigger(
		id: string,
		updates: WorkflowTriggerUpdate,
	): Promise<WorkflowTrigger | null> {
		await this.ready();
		const updated = await this.triggers.update(id, updates);
		if (updated) this.announceTriggers();
		return updated;
	}

	async deleteTrigger(id: string): Promise<boolean> {
		await this.ready();
		const deleted = await this.triggers.delete(id);
		if (deleted) this.announceTriggers();
		return deleted;
	}

	async listTriggers(
		params: PaginationParams,
	): Promise<PaginatedResult<WorkflowTrigger>> {
		await this.ready();
		const all = (await this.triggers.listAll()).filter(
			triggerFilters.predicate(params.filter),
		);
		return page(all, params);
	}

	/**
	 * What the runtime pulls to build its subscription set. Disabled triggers
	 * are filtered here rather than in the runtime, so switching one off takes
	 * effect on the next refresh without a redeploy.
	 */
	async activeTriggers(): Promise<{ items: WorkflowTrigger[] }> {
		await this.ready();
		const all = await this.triggers.listAll();
		return { items: all.filter((trigger) => trigger.enabled) };
	}

	/**
	 * Tell the bus the trigger set moved. The runtime subscribes to this topic
	 * like any other peer, so its own configuration reaches it the same way its
	 * work does — and a new trigger fires on the next event instead of waiting
	 * out a polling interval.
	 *
	 * Best effort on purpose: a bus that is down must not fail an operator's
	 * edit. The runtime's periodic refresh is the backstop.
	 */
	private announceTriggers(): void {
		createBusServiceClient(createServerNrpcClientConfig())
			.publish({ name: TRIGGERS_CHANGED_TOPIC, payload: {} })
			.catch((error) =>
				console.warn("[rp-dag] trigger change not announced", error),
			);
	}

	// ---- execution log -------------------------------------------------------

	/**
	 * Commit entries the runtime already cached, by name.
	 *
	 * Storage reads each cache entry and writes it to the store itself, so a
	 * batch costs this process one call per key and no payload at all. Keys are
	 * derived from the run and the node's sequence, so a repeat is a rewrite —
	 * which is what lets the runtime re-send a batch it is unsure about after a
	 * crash instead of reasoning about what got through.
	 *
	 * A key that fails is reported rather than thrown: one expired cache entry
	 * must not cost the batch the entries around it.
	 */
	async commitLog(keys: string[]): Promise<LogCommitResult> {
		await this.ready();
		const committed: string[] = [];
		const failed: string[] = [];

		for (const key of keys ?? []) {
			const target = storeKeyFor(key);
			if (!target) {
				failed.push(key);
				continue;
			}
			try {
				this.log.commit(target, key);
				committed.push(key);
			} catch (error) {
				console.warn(`[rp-dag] log entry ${key} not committed`, error);
				failed.push(key);
			}
		}

		return { committed, failed };
	}

	// ---- reading -------------------------------------------------------------

	async listExecutions(
		params: PaginationParams,
	): Promise<PaginatedResult<Execution>> {
		await this.ready();
		const items = this.log
			.listExecutions()
			.filter(executionFilters.predicate(params.filter));
		return page(items, params);
	}

	/** Staged in the cache; the caller reads it from `/cache/blob/<key>`. */
	async executionTree(id: string): Promise<CacheRef> {
		const tree = await this.buildTree(id);
		const bytes = new TextEncoder().encode(JSON.stringify(tree));
		const cacheKey = this.requiredCache().buildKey(
			"dag",
			"tree",
			crypto.randomUUID(),
		);
		await this.requiredCache().setBytes(
			cacheKey,
			bytes,
			CACHE_BLOB_TTL_SECONDS,
		);
		return { cacheKey, sizeBytes: bytes.byteLength };
	}

	/**
	 * One run flattened depth-first: each node in the order it opened, and
	 * immediately after a delegating node the nodes of the run it delegated to.
	 * The link is the node's own `childExecutionId`, so the walk needs no index
	 * and a child that was never recorded simply ends that branch.
	 */
	private async buildTree(id: string): Promise<ExecutionTree> {
		await this.ready();
		const execution = this.log.getExecution(id);
		if (!execution) throw notFound(`Execution ${id} not found`);

		const rows: ExecutionTreeRow[] = [];
		const executions: Execution[] = [execution];
		// A malformed childExecutionId cycle would otherwise walk forever.
		const seen = new Set<string>([id]);

		const walk = (executionId: string, depth: number): void => {
			for (const node of this.log.listNodes(executionId)) {
				rows.push({ ...node, depth, executionId });
				const childId = node.childExecutionId;
				if (!childId || depth >= MAX_TREE_DEPTH || seen.has(childId)) continue;
				seen.add(childId);
				const child = this.log.getExecution(childId);
				if (child) executions.push(child);
				walk(childId, depth + 1);
			}
		};
		walk(id, 0);

		return { execution, rows, executions };
	}

	async stats(): Promise<DagStats> {
		await this.ready();
		const all = this.log.listExecutions();

		const executions = {
			total: all.length,
			running: all.filter((item) => item.status === "running").length,
			done: all.filter((item) => item.status === "done").length,
			failed: all.filter((item) => item.status === "failed").length,
		};

		const byWorkflow: Record<string, number> = {};
		for (const item of all)
			byWorkflow[item.workflow] = (byWorkflow[item.workflow] ?? 0) + 1;

		return { executions, daily: daily(all, 30), byWorkflow };
	}

	// ---- selection -----------------------------------------------------------

	async describeSelection(objectType: string): Promise<SelectionDescriptor> {
		const fields = SELECTION_FIELDS[objectType];
		if (!fields)
			throw new Error(`Unsupported DAG selection object: ${objectType}`);
		return {
			objectType,
			title: objectType.replace("dag.", "DAG "),
			fields,
			revision: "dag-v2",
		};
	}

	async inspectSelection(
		objectType: string,
		filter?: FilterObject,
	): Promise<SelectionStats> {
		const empty = { offset: 0, limit: 0, filter };
		switch (objectType) {
			case "dag.workflow":
				return {
					totalCount: (await this.listWorkflows(empty)).totalCount ?? 0,
				};
			case "dag.execution":
				return {
					totalCount: (await this.listExecutions(empty)).totalCount ?? 0,
				};
			case "dag.trigger":
				return { totalCount: (await this.listTriggers(empty)).totalCount ?? 0 };
			default:
				throw new Error(`Unsupported DAG selection object: ${objectType}`);
		}
	}
}

const SELECTION_FIELDS: Record<
	string,
	SelectionDescriptor["fields"] | undefined
> = {
	"dag.workflow": [
		{
			id: "name",
			label: "Workflow",
			valueType: "string",
			operators: ["eq", "in", "contains", "startsWith"],
		},
		{
			id: "script",
			label: "Script",
			valueType: "string",
			operators: ["eq", "in", "contains", "startsWith"],
		},
	],
	"dag.execution": [
		{
			id: "workflow",
			label: "Workflow",
			valueType: "string",
			operators: ["eq", "in", "notEq", "notIn"],
		},
		{
			id: "status",
			label: "Status",
			valueType: "enum",
			operators: ["eq", "in", "notEq", "notIn"],
		},
		{
			id: "startedAt",
			label: "Started",
			valueType: "number",
			operators: ["gt", "gte", "lt", "lte", "between"],
		},
	],
	"dag.trigger": [
		{
			id: "name",
			label: "Name",
			valueType: "string",
			operators: ["eq", "in", "contains", "startsWith"],
		},
		{
			id: "topic",
			label: "Topic",
			valueType: "string",
			operators: ["eq", "in", "contains", "startsWith"],
		},
		{
			id: "enabled",
			label: "Enabled",
			valueType: "boolean",
			operators: ["eq", "notEq"],
		},
	],
};

function page<T>(items: T[], params: PaginationParams): PaginatedResult<T> {
	const offset = params.offset ?? 0;
	const limit = params.limit ?? 50;
	return {
		items: limit === 0 ? [] : items.slice(offset, offset + limit),
		totalCount: items.length,
	};
}

/** Runs per day over the trailing window, oldest day first. */
function daily(executions: Execution[], days: number): DagStatsPoint[] {
	const buckets = new Map<string, DagStatsPoint>();
	const dayMs = 24 * 60 * 60 * 1000;
	const today = new Date();
	for (let back = days - 1; back >= 0; back -= 1) {
		const date = new Date(today.getTime() - back * dayMs)
			.toISOString()
			.slice(0, 10);
		buckets.set(date, { date, total: 0, done: 0, failed: 0 });
	}
	for (const execution of executions) {
		const date = new Date(execution.startedAt).toISOString().slice(0, 10);
		const bucket = buckets.get(date);
		if (!bucket) continue;
		bucket.total += 1;
		if (execution.status === "done") bucket.done += 1;
		if (execution.status === "failed") bucket.failed += 1;
	}
	return [...buckets.values()];
}

/**
 * The store key a cache key stands for.
 *
 * The runtime composes `dag:log:<executionId>:exec` for a run and
 * `dag:log:<executionId>:n:<seq>` for one of its nodes; those map onto the two
 * prefixes this store keeps. Deriving the target here rather than taking it
 * from the caller means a runtime cannot write outside the log by naming a key
 * of its own choosing.
 */
function storeKeyFor(cacheKey: string): string[] | null {
	if (!cacheKey?.startsWith(LOG_KEY_PREFIX)) return null;
	const rest = cacheKey.slice(LOG_KEY_PREFIX.length);

	if (rest.endsWith(":exec")) {
		const executionId = rest.slice(0, -":exec".length);
		return executionId ? ["exec", executionId] : null;
	}

	const marker = rest.lastIndexOf(":n:");
	if (marker <= 0) return null;
	const executionId = rest.slice(0, marker);
	const seq = rest.slice(marker + ":n:".length);
	// The sequence is already zero-padded by the runtime; it has to stay that
	// way, because the store reads a run's nodes as an ordered key range.
	if (!executionId || seq.length !== SEQ_WIDTH || !/^\d+$/.test(seq))
		return null;
	return ["node", executionId, seq];
}

function badRequest(message: string): Error {
	return Object.assign(new Error(message), { statusCode: 400 });
}

function notFound(message: string): Error {
	return Object.assign(new Error(message), { statusCode: 404 });
}

function asParameters(
	value: unknown,
): AvailableWorkflow["parameters"] | undefined {
	if (!value || typeof value !== "object") return undefined;
	const parameters = value as Record<string, unknown>;
	if (
		parameters.type !== "object" ||
		!parameters.properties ||
		typeof parameters.properties !== "object"
	)
		return undefined;
	if (
		parameters.required !== undefined &&
		(!Array.isArray(parameters.required) ||
			parameters.required.some((item) => typeof item !== "string"))
	)
		return undefined;
	return {
		type: "object",
		properties: parameters.properties as Record<string, unknown>,
		...(parameters.required
			? { required: parameters.required as string[] }
			: {}),
	};
}

function parseStringMap(raw: string | undefined): Record<string, string> {
	if (!raw) return {};
	try {
		const value = JSON.parse(raw);
		if (!value || typeof value !== "object" || Array.isArray(value)) return {};
		return Object.fromEntries(
			Object.entries(value).filter(
				(entry): entry is [string, string] => typeof entry[1] === "string",
			),
		);
	} catch {
		return {};
	}
}
