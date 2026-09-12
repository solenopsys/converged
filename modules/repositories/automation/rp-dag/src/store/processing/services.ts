import { KvAccessTags, type KVStore } from "back-core";
import type { Execution, ExecutionNode } from "g-dag";
import {
	EXECUTION_PREFIX,
	ExecutionKey,
	ExecutionRepository,
	NodeKey,
	NodeRepository,
} from "./entities";

/** How many runs to keep. The log is diagnostics, not an archive. */
const DEFAULT_MAX_EXECUTIONS = 5000;

/** Prune every N committed entries rather than on each one. */
const PRUNE_INTERVAL = 500;

/**
 * The DAG log.
 *
 * A run is a tree: one `exec:<id>` record, its `node:<id>:<seq>` children in
 * the order they opened, and — for a node that delegated through `rt.sub` — the
 * child run its `childExecutionId` points at. Walking the tree therefore needs
 * no parent index: the link is the node that made it.
 *
 * Nothing here writes a log entry. The runtime does, into Valkey, and `commit`
 * only tells storage to pick it up: the entries are high volume and their
 * payload has no reason to pass through this process at all. What this class
 * owns is reading them back and keeping the log from growing without end.
 */
export class ProcessingStoreService {
	private readonly executions: ExecutionRepository;
	private readonly nodes: NodeRepository;
	/**
	 * Who may see which run.
	 *
	 * There is no table to join here, so the scheme is the key one from
	 * `access-control.md`: `tag:<tag>:<executionId>` alongside the log, read from
	 * the tag side. Only runs are tagged — a node is part of a run and is read
	 * through it, the same way a contact is read through its lead.
	 *
	 * A run is committed `authenticated`, which is the reach the console had,
	 * and carries the tag of whoever committed it — in practice the runtime's
	 * service account. What it buys is that the log stops being readable by
	 * anyone who can reach the port: a run's nodes hold the arguments and
	 * results a workflow passed around, which is as sensitive as whatever it was
	 * processing. Narrowing a workflow's runs to `team-*` is then a grant.
	 */
	readonly access: KvAccessTags;

	private committed = 0;

	constructor(
		private readonly kvStore: KVStore,
		private readonly maxExecutions = DEFAULT_MAX_EXECUTIONS,
	) {
		this.executions = new ExecutionRepository(kvStore);
		this.nodes = new NodeRepository(kvStore);
		this.access = new KvAccessTags(kvStore);
	}

	// ---- committing what the runtime cached -----------------------------------

	/**
	 * Move a cached entry into the store without reading it.
	 *
	 * The runtime wrote the bytes to Valkey; storage reads them from there and
	 * writes the store itself, so nothing about the entry passes through this
	 * process. That is the whole point — the log is high volume, and its payload
	 * has no business crossing the transport twice.
	 */
	commit(storeKey: string[], cacheKey: string): void {
		this.kvStore.putFromCache(storeKey, cacheKey);
		// The run record is what carries the audience; its nodes arrive under the
		// same execution id and answer to it. Tagging is idempotent, so a batch
		// re-sent after a crash does not double anything.
		const [prefix, executionId] = storeKey;
		if (prefix === EXECUTION_PREFIX && executionId) {
			this.access.tagNew(executionId, { visibility: "authenticated" });
		}
		this.committed += 1;
		if (this.committed % PRUNE_INTERVAL === 0) this.prune();
	}

	/** A run the caller holds no tag for reads as absent. */
	getExecution(id: string): Execution | undefined {
		if (!this.access.canRead(id)) return undefined;
		return this.executions.get(new ExecutionKey(id));
	}

	/**
	 * The runs the caller may see, newest first.
	 *
	 * The visible set is gathered from the tag side first, so what is read back
	 * is what the caller may see rather than the whole log filtered afterwards.
	 */
	listExecutions(): Execution[] {
		const visible = this.access.visibleIds();
		if (visible.size === 0) return [];
		return this.executions
			.listValues()
			.filter(
				(execution): execution is Execution =>
					Boolean(execution?.id) && visible.has(execution.id),
			)
			.sort((a, b) => b.startedAt - a.startedAt);
	}

	// ---- nodes ---------------------------------------------------------------

	/** A run's nodes in the order they opened — for a run the caller may see. */
	listNodes(executionId: string): ExecutionNode[] {
		if (!this.access.canRead(executionId)) return [];
		return this.nodes
			.listValuesByPrefix([executionId])
			.filter((node): node is ExecutionNode => typeof node?.seq === "number");
	}

	// ---- retention -----------------------------------------------------------

	/** Drop the oldest runs, and their nodes, once the log outgrows its cap. */
	private prune(): void {
		// Retention is the store's own business and runs over the whole log, not
		// over what the committing caller happens to be able to see.
		const all = this.executions
			.listValues()
			.filter((execution): execution is Execution => Boolean(execution?.id))
			.sort((a, b) => b.startedAt - a.startedAt);
		if (all.length <= this.maxExecutions) return;
		for (const execution of all.slice(this.maxExecutions)) {
			for (const node of this.nodes.listValuesByPrefix([execution.id]))
				this.nodes.delete(new NodeKey(execution.id, node.seq));
			this.executions.delete(new ExecutionKey(execution.id));
			// Without this the tags would outlive the run and later match a reused
			// execution id.
			this.access.dropObject(execution.id);
		}
	}
}
