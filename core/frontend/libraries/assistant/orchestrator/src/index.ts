import { createMachine } from "./machine";
import { createFunctionSteps } from "./steps";
import type {
	OneShotAsk,
	OrchestratorCatalog,
	OrchestratorPlan,
	PlanContext,
	Position,
	Step,
	StepPrompt,
	StepTrace,
	Tier,
} from "./types";

export type {
	ChatBlock,
	ChatDriver,
	ChatEvent,
	ResonusChatDriverOptions,
} from "./chat-driver";
export { createResonusChatDriver, wantsTools } from "./chat-driver";
export { parseJsonObject, readString } from "./json";
export type { Machine, MachineOptions } from "./machine";
export { createMachine } from "./machine";
export type {
	ResonusCommandTransport,
	ResonusSession,
	ResonusSessionOptions,
} from "./resonus-session";
export { createResonusSession } from "./resonus-session";
export type {
	CommandEnvelope,
	EnvelopeChannel,
	EnvelopeReply,
	ResonusTransportOptions,
} from "./resonus-transport";
export { createResonusCommandTransport } from "./resonus-transport";
// The stateful half: conversation entries, the catalog as a store, the turn
// budget and the engine that drives one turn end to end.
export * from "./state";
export type { FunctionStepsOptions } from "./steps";
export { createFunctionSteps } from "./steps";
export type { FilesIntent, FilesStepOptions, TurnFile } from "./steps-files";
export { createFilesStep } from "./steps-files";
export type {
	SurfaceCommitIds,
	SurfaceStepsOptions,
} from "./steps-surface";
export {
	chosenNumber,
	createSurfaceSteps,
	DEFAULT_COMMITS,
	positionLine,
} from "./steps-surface";
export type {
	Choice,
	FunctionBrief,
	FunctionChoice,
	OneShotAsk,
	OrchestratorCatalog,
	OrchestratorPlan,
	PlanContext,
	Position,
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
	/**
	 * Replaces the built-in flow — the extension point of the kernel. A factory
	 * composes with it instead of replacing it, and is the only way to reach the
	 * catalog the flow is built against.
	 */
	steps?:
		| ReadonlyArray<Step<PlanContext>>
		| ((catalog: OrchestratorCatalog) => ReadonlyArray<Step<PlanContext>>);
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
	steps,
}: OrchestratorOptions): Orchestrator {
	const machine = createMachine<PlanContext>({
		steps:
			typeof steps === "function"
				? steps(catalog)
				: (steps ?? createFunctionSteps({ catalog })),
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
