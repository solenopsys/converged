import type { KVStore } from "back-core";
import type { Execution, ExecutionNode } from "g-dag";
import {
	ExecutionKey,
	ExecutionRepository,
	NodeKey,
	NodeRepository,
	VariableKey,
	VariableRepository,
} from "./entities";

/** How many runs to keep. The log is diagnostics, not an archive. */
const DEFAULT_MAX_EXECUTIONS = 5000;

/** Prune every N committed entries rather than on each one. */
const PRUNE_INTERVAL = 500;

const JSON_HEADER = "KVJ0";
const BUFFER_HEADER = "KVB0";
const HEADER_LENGTH = 4;
const MAX_TEXT_PREVIEW = 2048;

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
	private readonly variables: VariableRepository;

	private committed = 0;

	constructor(
		private readonly kvStore: KVStore,
		private readonly maxExecutions = DEFAULT_MAX_EXECUTIONS,
	) {
		this.executions = new ExecutionRepository(kvStore);
		this.nodes = new NodeRepository(kvStore);
		this.variables = new VariableRepository(kvStore);
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

	// ---- variables -----------------------------------------------------------

	setVar<T = any>(key: string, value: T): void {
		this.variables.save(new VariableKey(key), value);
	}

	getVar<T = any>(key: string): T | undefined {
		return this.variables.get(new VariableKey(key)) as T | undefined;
	}

	deleteVar(key: string): void {
		this.variables.delete(new VariableKey(key));
	}

	/**
	 * Variables with their values summarised. A workflow may park a whole
	 * document under one key, and the list view only needs enough of it to be
	 * recognisable.
	 */
	listVars(): { key: string; value: any }[] {
		return this.variables.listKeys().map((rawKey) => ({
			key: rawKey.replace(/^persistent:/, ""),
			value: preview(this.kvStore.getRawDirect(rawKey)),
		}));
	}
}

function preview(raw: Buffer | null): any {
	if (!raw) return undefined;
	if (raw.length < HEADER_LENGTH) return truncateText(raw.toString("utf8"));

	const header = raw.subarray(0, HEADER_LENGTH).toString("utf8");
	const payload = raw.subarray(HEADER_LENGTH);

	if (header === BUFFER_HEADER) return `[binary ${payload.length} bytes]`;
	if (header === JSON_HEADER) {
		if (payload.length > MAX_TEXT_PREVIEW) return truncateBuffer(payload);
		const text = payload.toString("utf8");
		try {
			return JSON.parse(text);
		} catch {
			return text;
		}
	}
	return truncateBuffer(raw);
}

function truncateText(text: string): string {
	if (text.length <= MAX_TEXT_PREVIEW) return text;
	return `${text.slice(0, MAX_TEXT_PREVIEW)}… [truncated ${text.length} chars]`;
}

function truncateBuffer(buffer: Buffer): string {
	if (buffer.length <= MAX_TEXT_PREVIEW) return buffer.toString("utf8");
	const head = buffer.subarray(0, MAX_TEXT_PREVIEW).toString("utf8");
	return `${head}… [truncated ${buffer.length} bytes]`;
}
