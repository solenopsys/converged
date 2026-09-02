// The global surface the RT VM (navite/apps/centimanus) installs before a
// workflow runs — see src/prelude.js there. Importing anything from dag-core
// pulls these declarations into the program; workflow files just use `rt`,
// `__execId` and `__params` as globals.
// The contract is synchronous: one QuickJS evaluation per DAG step, no
// Promises, no event loop. All side effects belong inside rt.node/rt.attempt.

export type LlmToolCall = {
	id: string;
	name: string;
	args: Record<string, unknown>;
};

export type LlmMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	toolCalls?: LlmToolCall[];

	toolCallId?: string;
	name?: string;
};

export type LlmTool = {
	name: string;
	description?: string;
	parameters?: Record<string, unknown>;
};

export type LlmRequest = {
	provider: string;
	model: string;
	maxTokens: number;
	messages: LlmMessage[];
	tools?: LlmTool[];
	temperature?: number;
};

export type LlmResponse = {
	provider: string;
	model: string;
	text: string;
	toolCalls: LlmToolCall[];
	finishReason: string;
	usage: { input: number; output: number };
};

export type Attempt<T> = { ok: true; value: T } | { ok: false; error: string };

export interface RtApi {
	call(
		service: string,
		method: string,
		params?: Record<string, unknown>,
	): unknown;
	get(key: string): unknown;
	set(key: string, value: unknown): void;
	log(message: string): void;

	llm(params: LlmRequest): LlmResponse;

	node<T>(name: string, fn: () => T): T;

	attempt<T>(name: string, fn: () => T): Attempt<T>;

	/** Delegate one step to another workflow. The engine runs the child from its
	 * step loop and stores the outcome under this node's key, so a delegation
	 * caches and resumes exactly like a node. `sub` throws on a child failure,
	 * `subAttempt` hands it back so a batch can survive one bad item. */
	sub<T>(name: string, scriptPath: string, params?: unknown): T;

	subAttempt<T>(name: string, scriptPath: string, params?: unknown): Attempt<T>;

	workflow?: (params: any) => unknown;
}

declare global {
	const rt: RtApi;

	const __execId: string | undefined;

	const __params: unknown;
}
