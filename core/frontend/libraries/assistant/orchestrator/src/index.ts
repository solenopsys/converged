import { createMachine } from "./machine";
import { createFunctionSteps } from "./steps";
import type {
	OneShotAsk,
	OrchestratorCatalog,
	OrchestratorPlan,
	PlanContext,
	Step,
	StepPrompt,
	StepTrace,
	Tier,
} from "./types";

export { createMachine } from "./machine";
export type { Machine, MachineOptions } from "./machine";
export { createFunctionSteps } from "./steps";
export type { FunctionStepsOptions } from "./steps";
export { createResonusSession } from "./resonus-session";
export type {
	ResonusCommandTransport,
	ResonusSession,
	ResonusSessionOptions,
} from "./resonus-session";
export { createResonusChatDriver, wantsTools } from "./chat-driver";
export type {
	ChatBlock,
	ChatDriver,
	ChatEvent,
	ResonusChatDriverOptions,
} from "./chat-driver";
export { createResonusCommandTransport } from "./resonus-transport";
export type {
	CommandEnvelope,
	EnvelopeChannel,
	EnvelopeReply,
	ResonusTransportOptions,
} from "./resonus-transport";
// The stateful half: conversation entries, the catalog as a store, the turn
// budget and the engine that drives one turn end to end.
export * from "./state";
export { parseJsonObject, readString } from "./json";
export type {
	FunctionBrief,
	OneShotAsk,
	OrchestratorCatalog,
	OrchestratorPlan,
	PlanContext,
	Step,
	StepAnswer,
	StepPrompt,
	StepResult,
	StepToolCall,
	StepTrace,
	Tier,
	ToolSpec,
} from "./types";

/** Built-in step names; a custom table may use any others. */
export type StepName =
	| "route"
	| "search"
	| "select"
	| "args"
	| "answer"
	| (string & {});

export type OrchestratorOptions = {
	ask: OneShotAsk;
	prompt: StepPrompt;
	catalog: OrchestratorCatalog;
	onStep?: (trace: StepTrace) => void;
	tier?: (step: string) => Tier | undefined;
	/** Replaces the built-in flow entirely — the extension point of the kernel. */
	steps?: ReadonlyArray<Step<PlanContext>>;
};

export type Orchestrator = {
	plan(userText: string): Promise<OrchestratorPlan>;
};

/** The default composition: built-in function flow over the step machine. */
export function createOrchestrator({
	ask,
	prompt,
	catalog,
	onStep,
	tier,
	steps = createFunctionSteps({ catalog }),
}: OrchestratorOptions): Orchestrator {
	const machine = createMachine<PlanContext>({
		steps,
		ask,
		prompt,
		onStep,
		tier,
	});
	return {
		plan: (userText) => machine.run({ userText, candidates: [] }),
	};
}

// No catalog: an embed widget has nothing to mount on a third-party page. An
// empty search ends the run at `search`, before select/args, so a host without
// functions costs exactly one vendor round-trip.
export const emptyCatalog: OrchestratorCatalog = {
	search: () => [],
	listCategories: () => [],
	meta: () => undefined,
	invoke: (id) => {
		throw new Error(
			`[orchestrator] No catalog in this host: cannot call "${id}"`,
		);
	},
};
