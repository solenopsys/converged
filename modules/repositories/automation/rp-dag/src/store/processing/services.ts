import type { KVStore } from "back-core";
import type { Execution, ExecutionNode } from "g-dag";
import {
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

	private committed = 0;

	constructor(
		private readonly kvStore: KVStore,
		private readonly maxExecutions = DEFAULT_MAX_EXECUTIONS,
	) {
		this.executions = new ExecutionRepository(kvStore);
		this.nodes = new NodeRepository(kvStore);
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
		this.committed += 1;
		if (this.committed % PRUNE_INTERVAL === 0) this.prune();
	}

	getExecution(id: string): Execution | undefined {
		return this.executions.get(new ExecutionKey(id));
	}

	/** Every run, newest first. */
	listExecutions(): Execution[] {
		return this.executions
			.listValues()
			.filter((execution): execution is Execution => Boolean(execution?.id))
			.sort((a, b) => b.startedAt - a.startedAt);
	}

	// ---- nodes ---------------------------------------------------------------

	/** A run's nodes in the order they opened. */
	listNodes(executionId: string): ExecutionNode[] {
		return this.nodes
			.listValuesByPrefix([executionId])
			.filter((node): node is ExecutionNode => typeof node?.seq === "number");
	}

	// ---- retention -----------------------------------------------------------

	/** Drop the oldest runs, and their nodes, once the log outgrows its cap. */
	private prune(): void {
		const all = this.listExecutions();
		if (all.length <= this.maxExecutions) return;
		for (const execution of all.slice(this.maxExecutions)) {
			for (const node of this.listNodes(execution.id))
				this.nodes.delete(new NodeKey(execution.id, node.seq));
			this.executions.delete(new ExecutionKey(execution.id));
		}
	}
}
