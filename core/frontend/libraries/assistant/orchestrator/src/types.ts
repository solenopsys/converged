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
	/** Full intent text used to rank and choose a function. */
	description?: string;
	category?: string;
	priority?: "primary" | "normal" | "secondary";
	/** Owning module — the first level the flow chooses (`sf-sales`, `workflows`). */
	module?: string;
	/** Human name of that module; travels with the function so no second registry is needed. */
	moduleLabel?: string;
	/**
	 * The catalog offered this as a near miss, not as a match. A flow that treats
	 * a guess as a hit calls something the user never asked for, so the choice is
	 * carried to the transcript instead of being smoothed over.
	 */
	approximate?: boolean;
	/**
	 * The kind of thing this acts on, compared for equality against what the
	 * conversation is working on. Opaque to the kernel — it never interprets the
	 * value, only matches it.
	 */
	targetType?: string;
	/**
	 * What it does to that kind. `create` starts a new one and therefore competes
	 * with work already in progress; the others continue it.
	 */
	intent?: "create" | "mutate" | "read";
};

/**
 * One thing the conversation is working on right now.
 *
 * This is the answer to "which audit", "which request" — a question the user
 * answers by opening something, and never by naming an id. The kernel holds no
 * state (see machine.ts), so the list arrives per turn from the host, which owns
 * it and decides when something joins or leaves.
 */
export type FocusEntry = {
	/** Opaque address of the thing. The kernel carries it; the host decodes it. */
	key: string;
	/** Matched against a function's `targetType`. */
	type: string;
	label: string;
};

/**
 * Where the user is standing: the tab, the button pressed inside it, and what
 * that button is showing.
 *
 * Not the same as the focus list, and it replaces it as the thing every step
 * reads. The list answers "what has been worked on lately"; this answers "what
 * is on screen right now", which is what decides whether a request continues
 * the current place or moves somewhere else — and therefore whether the first
 * two steps have to run at all.
 */
export type Position = {
	/** Id of the active surface; absent when nothing is mounted. */
	surface?: string;
	surfaceLabel?: string;
	/** Key of the pressed subtab; absent is the normal state, not an error. */
	subtab?: string;
	subtabLabel?: string;
	/** Type of the thing the pressed subtab shows, matched against `targetType`. */
	type?: string;
	/** One short line about the current state — a filter, a count. Never JSON. */
	state?: string;
};

/** One choice offered to a numbered step, in the order it was listed. */
export type Choice = {
	id: string;
	label: string;
	/** Second line: what it is for, or what it does. */
	detail?: string;
};

/**
 * One decision the flow made out of a list it was given. This is the catalog and
 * the app's own choice — not the model's reasoning: no prompt, no outcome text,
 * nothing a step said to itself. That distinction is what lets it be shown in
 * the conversation while `StepEntry` stays in the log.
 */
export type FunctionChoice = {
	/** The deciding step: `module`, `select`, or a host's own. */
	step: string;
	/** Id of what was chosen. */
	chosen: string;
	chosenLabel?: string;
	/** Everything that was on the table, chosen one included. */
	options: Array<{ id: string; label: string }>;
	/**
	 * A qualifier on the decision, as a code rather than prose: the kernel has no
	 * locale and must not invent user-facing wording. `widened` — the narrowing
	 * found nothing and the whole catalog was searched anyway; `approximate` —
	 * the options were near misses rather than matches.
	 */
	note?: "widened" | "approximate";
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

/** Step instructions live in rp-contexts, one section per step (§4.3). */
export type StepPrompt = (step: string) => Promise<string | undefined>;

/**
 * The host's functions. The kernel sees ids, briefs and a fact — never a view,
 * a component or a payload, so it stays free of domain knowledge.
 */
export type OrchestratorCatalog = {
	search(query: string, limit?: number): FunctionBrief[];
	listCategories(): Array<{ id: string; count: number }>;
	/**
	 * The modules the catalog is divided into. Optional: a host that publishes a
	 * flat catalog simply skips the module step and searches everything, which is
	 * the behaviour every host had before modules existed.
	 */
	listModules?(): Array<{
		id: string;
		label: string;
		count: number;
		/** What the module can do, supplied by its own LLM manifest. */
		description?: string;
	}>;
	/** Every callable function owned by one module, for the second routing level. */
	byModule?(module: string): FunctionBrief[];
	/**
	 * Every function acting on these kinds of thing, regardless of wording.
	 *
	 * Search is lexical, and the reply that continues a piece of work does not
	 * repeat its vocabulary: "about 5%" shares no word with "Record an audit
	 * answer", so ranking drops it before priority can matter. What the user is
	 * working on has to admit its own functions, not merely reorder them.
	 */
	byTarget?(types: readonly string[]): FunctionBrief[];
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
	/**
	 * Prepares one selected function for invocation. A host uses this to fetch
	 * server-owned argument capabilities before the argument model runs.
	 */
	load?(id: string): Promise<ToolSpec["parameters"] | void>;
	/**
	 * The buttons already open inside one module. They are choices at the same
	 * level as its functions — pressing one is what the user meant by naming
	 * something already on screen — so the action step offers both together.
	 */
	subtabs?(
		module: string,
	): Array<{ key: string; title: string; pressed: boolean }>;
};

export type StepTrace = {
	step: string;
	tier: Tier;
	/** Whether this covers the model request or the local step implementation. */
	phase: "model" | "apply";
	startedAt: number;
	/** Exact input supplied to a one-shot model step. */
	input?: string;
	finishedAt?: number;
	outcome?: string;
};

export type OrchestratorPlan =
	| { kind: "answer" }
	| {
			kind: "function";
			id: string;
			args: Record<string, unknown>;
			fact: unknown;
			/** How this function was arrived at, for the transcript to show. */
			trail?: FunctionChoice[];
	  }
	| {
			/** A function matched, but calling it would require inventing user data. */
			kind: "function-incomplete";
			id: string;
			args: Record<string, unknown>;
			missing: string[];
			trail?: FunctionChoice[];
	  }
	| {
			kind: "function-missed";
			area: string;
			candidates: FunctionBrief[];
			trail?: FunctionChoice[];
	  };

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
	/** An empty model reply is a valid fallback for this optional step. */
	allowEmptyAnswer?: boolean;
	/**
	 * An empty reply means nothing to this step, so ask once more before acting
	 * on it. For a deciding step that always wants a tool call — light models
	 * return nothing often enough that one retry is cheaper than a dead turn.
	 */
	retryWhenEmpty?: boolean;
	/**
	 * Step-specific retry predicate for structured answers that are present but
	 * incomplete. Like `retryWhenEmpty`, it is evaluated once: the machine never
	 * turns it into an unbounded retry loop.
	 */
	retryWhen?(context: Readonly<Context>, answer: StepAnswer): boolean;
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
	/** Compact host state captured once at the beginning of a turn. */
	hostContext?: unknown;
	/** What the conversation is working on, captured once with `hostContext`. */
	focus?: FocusEntry[];
	/** Where the user is standing, captured once at the start of the turn. */
	position?: Position;
	area?: string;
	/** Module the route step narrowed to; absent means search everything. */
	module?: string;
	candidates: FunctionBrief[];
	id?: string;
	/** Decisions made so far, in order. Carried into the plan for the transcript. */
	trail?: FunctionChoice[];
	/** Server-owned argument schema fetched after the function was selected. */
	parameters?: ToolSpec["parameters"];
	/** What the chosen function acts on; compared against the position's type. */
	targetType?: string;
	/**
	 * Argument values the host already knows — ids of the files this turn is
	 * about, the record a screen is open on. They are merged under whatever the
	 * argument model produces, so a step that has the data hands it over instead
	 * of asking a model to copy it out of the prompt.
	 */
	known?: Record<string, unknown>;
	/** `known` is the whole call: the argument step has nothing left to ask. */
	argumentsFinal?: boolean;
	args?: Record<string, unknown>;
};
