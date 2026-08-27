// Ports of the step machine. Everything the kernel needs from the outside world
// is one of these four; nothing else is imported, so the same machine runs in a
// browser tab, in an embed widget and in the CLI (docs/AI.md §4.7).

/**
 * A named model entity, not a vendor model name: the gateway resolves it to a
 * pool (§5.6). Steps name their own entity, which is how one turn mixes models.
 */
export type Tier = "fast" | "heavy" | (string & {});

export type FunctionBrief = {
	id: string;
	brief: string;
	category?: string;
	priority?: "primary" | "normal" | "secondary";
};

/**
 * The output shape a step asks the model for. The gateway carries this to every
 * vendor (`options.tools` → `ChatRequest.tools`), so a step gets a structured
 * answer instead of prose it has to parse.
 */
export type ToolSpec = {
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
};

export type StepToolCall = {
	name: string;
	args: Record<string, unknown>;
};

/** What a step gets back: the structured calls, and the prose if there was any. */
export type StepAnswer = {
	text: string;
	toolCalls: StepToolCall[];
};

/** One instruction, one utterance, no history — the gateway keeps none either. */
export type OneShotAsk = (input: {
	step: string;
	system: string;
	user: string;
	tier: Tier;
	tools: ToolSpec[];
}) => Promise<StepAnswer>;

/** Step instructions live in ms-contexts, one section per step (§4.3). */
export type StepPrompt = (step: string) => Promise<string | undefined>;

/**
 * The host's functions. The kernel sees ids, briefs and a fact — never a view,
 * a component or a payload, so it stays free of domain knowledge.
 */
export type OrchestratorCatalog = {
	search(query: string, limit?: number): FunctionBrief[];
	listCategories(): Array<{ id: string; count: number }>;
	meta(id: string):
		| {
				id: string;
				brief?: string;
				description: string;
				category?: string;
				priority?: FunctionBrief["priority"];
				/** Argument schema, when the host knows one: the args step asks for it directly. */
				parameters?: ToolSpec["parameters"];
		  }
		| undefined;
	invoke(id: string, args: Record<string, unknown>): unknown | Promise<unknown>;
	/** Speculative load of the top candidate while the model builds arguments. */
	load?(id: string): Promise<void>;
};

export type StepTrace = {
	step: string;
	tier: Tier;
	startedAt: number;
	finishedAt?: number;
	outcome?: string;
};

export type OrchestratorPlan =
	| { kind: "answer" }
	| { kind: "function"; id: string; args: Record<string, unknown>; fact: unknown }
	| { kind: "function-missed"; area: string; candidates: FunctionBrief[] };

/**
 * A step module. `ask` returning undefined means the step is local — it costs no
 * vendor round-trip. `apply` either patches the context or ends the run; there is
 * no "go back", which is what keeps a run finite (see machine.ts).
 */
export type Step<Context> = {
	name: string;
	tier?: Tier;
	when?(context: Readonly<Context>): boolean;
	ask?(context: Readonly<Context>): string | undefined;
	/** The shape the step wants back; empty means a plain text answer. */
	tools?(context: Readonly<Context>): ToolSpec[];
	apply(
		context: Readonly<Context>,
		answer: StepAnswer | undefined,
	): StepResult<Context> | Promise<StepResult<Context>>;
};

export type StepResult<Context> = {
	patch?: Partial<Context>;
	done?: OrchestratorPlan;
};

/** Context of the built-in function flow (steps.ts). */
export type PlanContext = {
	userText: string;
	area?: string;
	candidates: FunctionBrief[];
	id?: string;
	args?: Record<string, unknown>;
};
