import type {
	OneShotAsk,
	OrchestratorPlan,
	Step,
	StepAnswer,
	StepPrompt,
	StepTrace,
	Tier,
} from "./types";

// The kernel: one pass over a step table. Three properties are structural, not
// disciplinary — they are why this is a library and not a workflow engine
// (docs/AI.md §4.7):
//
// * no state — the context lives for one run and dies with it; history belongs
//   to the gateway, keyed by id, and durable state belongs to centimanus;
// * no domain knowledge — steps talk to ports (catalog, prompt, ask) only;
// * no buffering — the context is patched, never accumulated, and a step that
//   would carry a payload instead of a reference is the caller's bug (steps.ts
//   enforces a size ceiling on the one value that comes from outside).
//
// A run is finite by construction: the table is walked forward once, so the
// number of vendor round-trips is bounded by the number of steps. There is no
// scheduler, no graph and no retry loop here — those are the things that force
// state, and the moment a scenario needs them it belongs in centimanus.

export type MachineOptions<Context> = {
	steps: ReadonlyArray<Step<Context>>;
	ask: OneShotAsk;
	prompt: StepPrompt;
	onStep?: (trace: StepTrace) => void;
	/** Overrides a step's own tier — the section in rp-contexts configures it. */
	tier?: (step: string) => Tier | undefined;
};

export type Machine<Context> = {
	run(initial: Context): Promise<OrchestratorPlan>;
};

const isEmpty = (answer: StepAnswer): boolean =>
	answer.toolCalls.every((call) => Object.keys(call.args).length === 0) &&
	!answer.text.trim();

export function createMachine<Context>({
	steps,
	ask,
	prompt,
	onStep,
	tier,
}: MachineOptions<Context>): Machine<Context> {
	async function askStep(
		step: Step<Context>,
		context: Context,
		user: string,
	): Promise<StepAnswer | undefined> {
		const system = await prompt(step.name);
		if (!system) {
			console.warn(
				`[orchestrator] Step "${step.name}" has no prompt: add the section to the chat context in rp-contexts`,
			);
			return undefined;
		}

		const level = tier?.(step.name) ?? step.tier ?? "fast";
		const tools = step.tools?.(context) ?? [];
		const trace: StepTrace = {
			step: step.name,
			tier: level,
			phase: "model",
			startedAt: Date.now(),
			input: user,
		};
		onStep?.(trace);
		try {
			let answer = await ask({
				step: step.name,
				system,
				user,
				tier: level,
				tools,
			});
			// A light model intermittently answers a tool-call step with nothing at
			// all — no call, no prose. That is not a decision and not a failure of
			// the request either, so the step is asked once more before anything is
			// concluded from it. One retry, and only for a step that says an empty
			// answer is meaningless to it: this is not a retry loop, the run stays
			// finite, and a step where empty is a valid answer never pays for it.
			if (
				step.retryWhen?.(context, answer) ||
				(step.retryWhenEmpty && isEmpty(answer))
			) {
				onStep?.({
					...trace,
					finishedAt: Date.now(),
					outcome: "empty: asking once more",
				});
				answer = await ask({
					step: step.name,
					system,
					user,
					tier: level,
					tools,
				});
			}
			const outcome = answer.toolCalls.length
				? answer.toolCalls
						.map((call) => `${call.name}(${JSON.stringify(call.args)})`)
						.join(" ")
				: answer.text;
			onStep?.({ ...trace, finishedAt: Date.now(), outcome });
			// Neither a call nor a word is not an answer: treating it as one makes
			// the run degrade into "no function needed" and look like a decision.
			if (!step.allowEmptyAnswer && isEmpty(answer)) {
				throw new Error(
					`[orchestrator] Step "${step.name}" came back empty from the ${level} model`,
				);
			}
			return answer;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			onStep?.({
				...trace,
				finishedAt: Date.now(),
				outcome: `error: ${message}`,
			});
			throw error;
		}
	}

	return {
		async run(initial: Context): Promise<OrchestratorPlan> {
			let context = initial;

			for (const step of steps) {
				if (step.when && !step.when(context)) continue;

				const user = step.ask?.(context);
				const answer =
					user === undefined ? undefined : await askStep(step, context, user);

				const trace: StepTrace = {
					step: step.name,
					tier: tier?.(step.name) ?? step.tier ?? "fast",
					phase: "apply",
					startedAt: Date.now(),
				};
				onStep?.(trace);
				let result: Awaited<ReturnType<Step<Context>["apply"]>>;
				try {
					result = await step.apply(context, answer);
					onStep?.({
						...trace,
						finishedAt: Date.now(),
						outcome: JSON.stringify(result),
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					onStep?.({
						...trace,
						finishedAt: Date.now(),
						outcome: `error: ${message}`,
					});
					throw error;
				}
				if (result.done) return result.done;
				if (result.patch) context = { ...context, ...result.patch };
			}

			// Falling through means the table has no terminal step. Guessing an
			// outcome here would hide a wiring error behind a plausible answer.
			throw new Error(
				"[orchestrator] Step table ended without a plan: the last step must return `done`",
			);
		},
	};
}
