import { createMachine } from "./machine";
import { createSelectedFunctionSteps } from "./steps";
import type { CaseRouter } from "./case-router";
import type {
	OneShotAsk,
	Orchestrator,
	OrchestratorCatalog,
	OrchestratorPlan,
	PlanContext,
	StepPrompt,
	StepTrace,
	Tier,
} from "./types";

export type CaseOrchestratorOptions = {
	ask: OneShotAsk;
	prompt: StepPrompt;
	catalog: OrchestratorCatalog;
	router: CaseRouter;
	onStep?: (trace: StepTrace) => void;
	tier?: (step: string) => Tier | undefined;
};

/**
 * Surface command flow: CASE owns command selection; the LLM only fills the
 * selected command's parameters. A miss is intentionally an answer plan, not
 * a return to the legacy route/search/select flow.
 */
export function createCaseOrchestrator({
	ask,
	prompt,
	catalog,
	router,
	onStep,
	tier,
}: CaseOrchestratorOptions): Orchestrator {
	const machine = createMachine<PlanContext>({
		steps: createSelectedFunctionSteps({ catalog }),
		ask,
		prompt,
		onStep,
		tier,
	});

	return {
		async plan(userText: string): Promise<OrchestratorPlan> {
			const decision = await router.route(userText);
			if (!decision || !catalog.meta(decision.command)) {
				return { kind: "answer" };
			}
			return machine.run({
				userText,
				candidates: [],
				id: decision.command,
			});
		},
	};
}
