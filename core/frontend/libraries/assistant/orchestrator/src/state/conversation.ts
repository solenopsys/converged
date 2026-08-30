import { createDomain, type Domain, type EventCallable, type Store } from "effector";
import { type ChatBlock, type ChatDriver, wantsTools } from "../chat-driver";
import { createMachine } from "../machine";
import { createFunctionSteps } from "../steps";
import type {
	OneShotAsk,
	OrchestratorCatalog,
	OrchestratorPlan,
	PlanContext,
	Step,
	StepPrompt,
	StepToolCall,
	Tier,
	ToolSpec,
} from "../types";
import { createConversationCatalog, type ConversationCatalog } from "./catalog";
import {
	CONVERSATION,
	createConversationEntries,
	type ConversationEntries,
	type Entry,
} from "./entries";
import {
	createConversationTurn,
	loopMessage,
	type ConversationTurn,
	type TurnBudget,
} from "./turn";

// One turn, end to end: decide with the steps, answer with the model, run what
// the model calls, stop when the budget says so. Everything it learns is written
// into the stores as entries; nothing is returned to be stored a second time.
// This is the whole reason the CLI and the tab can share it — neither owns the
// state of the exchange, they only read it.

export type ExecutableTool = ToolSpec & {
	execute(args: Record<string, unknown>): unknown | Promise<unknown>;
};

export type ConversationOptions = {
	/** One-shot port for the deciding steps. */
	ask: OneShotAsk;
	prompt: StepPrompt;
	/** Streaming port for the conversational answer. */
	driver: ChatDriver;
	catalog?: ConversationCatalog;
	steps?: ReadonlyArray<Step<PlanContext>>;
	systemPrompt?: () => Promise<string | undefined>;
	budget?: TurnBudget;
	tier?: (step: string) => Tier | undefined;
	/** Names the answer's log; the steps log under their own tier. */
	model?: string;
	domain?: Domain;
};

export type Conversation = {
	domain: Domain;
	entries: ConversationEntries;
	catalog: ConversationCatalog;
	turn: ConversationTurn;
	$tools: Store<Map<string, ExecutableTool>>;
	toolRegistered: EventCallable<ExecutableTool>;
	failed: EventCallable<string>;
	send(text: string): Promise<void>;
	registerTool(tool: ExecutableTool): void;
	/** Execute a registered tool without asking the model, retaining the call trace. */
	invokeTool(name: string, args: Record<string, unknown>): Promise<unknown>;
	/** The plan alone, for hosts that want the decision without an answer. */
	plan(text: string): Promise<OrchestratorPlan>;
};

const id = (): string => crypto.randomUUID();

const errorOf = (value: unknown): string | undefined => {
	if (typeof value !== "object" || value === null || !("ok" in value)) return undefined;
	if (value.ok !== false) return undefined;
	return typeof value.error === "string" ? value.error : "Function failed";
};

const factOf = (plan: OrchestratorPlan): string | undefined => {
	if (plan.kind === "function") {
		const failed =
			typeof plan.fact === "object" &&
			plan.fact !== null &&
			(plan.fact as { ok?: unknown }).ok === false;
		return JSON.stringify(
			failed
				? { id: plan.id, args: plan.args, error: (plan.fact as { error?: string }).error }
				: { id: plan.id, args: plan.args, result: plan.fact },
		);
	}
	if (plan.kind === "function-missed") {
		// The model must know no function matched, or it promises a screen that
		// does not exist.
		return JSON.stringify({
			requested: plan.area,
			available: plan.candidates.map((fn) => fn.id),
			note: "No matching function in the catalog; answer with words.",
		});
	}
	return undefined;
};

export function createConversation({
	ask,
	prompt,
	driver,
	catalog = createConversationCatalog(),
	steps,
	systemPrompt,
	budget,
	tier,
	model,
	domain = createDomain("conversation"),
}: ConversationOptions): Conversation {
	const entries = createConversationEntries(domain);
	const turn = createConversationTurn(budget, domain);

	const toolRegistered = domain.createEvent<ExecutableTool>("TOOL_REGISTERED");
	const failed = domain.createEvent<string>("TURN_FAILED");

	const $tools = domain
		.createStore<Map<string, ExecutableTool>>(new Map(), { name: "TOOLS" })
		.on(toolRegistered, (tools, tool) => new Map(tools).set(tool.name, tool));

	const answerStream = `model:${model ?? "answer"}`;
	let systemSent = false;

	const append = (entry: Entry): Entry => {
		entries.appended(entry);
		return entry;
	};

	const runSteps = async (text: string): Promise<OrchestratorPlan> => {
		// Frozen for the whole turn: a function chosen by `select` must still be
		// there at `invoke`.
		const frozen: OrchestratorCatalog = catalog.snapshot();
		const table = steps ?? createFunctionSteps({ catalog: frozen });
		const open = new Map<string, string>();

		const machine = createMachine<PlanContext>({
			steps: table,
			ask,
			prompt,
			tier,
			onStep: (trace) => {
				const key = `${trace.phase}:${trace.step}:${trace.startedAt}`;
				if (trace.finishedAt === undefined) {
					const entryId = id();
					open.set(key, entryId);
					append({
						id: entryId,
						at: trace.startedAt,
						// Steps are the machine's own reasoning: they belong to the
						// model's log, not to what the user reads.
						streams: [`model:${trace.tier}`],
						kind: "step",
						step: trace.step,
						tier: trace.tier,
						phase: trace.phase,
						input: trace.input,
						status: "running",
					});
					return;
				}
				const entryId = open.get(key);
				if (!entryId) return;
				open.delete(key);
				entries.patched({
					id: entryId,
					patch: {
						status: trace.outcome?.startsWith("error:") ? "failed" : "completed",
						outcome: trace.outcome,
						elapsedMs: trace.finishedAt - trace.startedAt,
					},
				});
			},
		});

		const startedAt = Date.now();
		const plan = await machine.run({ userText: text, candidates: [] });
		if (plan.kind === "function") {
			const failure =
				typeof plan.fact === "object" &&
				plan.fact !== null &&
				(plan.fact as { ok?: unknown }).ok === false;
			append({
				id: id(),
				at: Date.now(),
				streams: [CONVERSATION],
				kind: "call",
				name: plan.id,
				args: plan.args,
				status: failure ? "failed" : "completed",
				elapsedMs: Date.now() - startedAt,
				result: failure ? undefined : plan.fact,
				error: failure ? (plan.fact as { error?: string }).error : undefined,
			});
		}
		return plan;
	};

	const execute = async (call: StepToolCall & { id: string }): Promise<unknown> => {
		const startedAt = Date.now();
		const entryId = id();
		append({
			id: entryId,
			at: Date.now(),
			streams: [CONVERSATION],
			kind: "call",
			name: call.name,
			callId: call.id,
			args: call.args,
			status: "running",
		});

		const tool = $tools.getState().get(call.name);
		if (!tool) {
			const error = `Function "${call.name}" not found`;
			entries.patched({
				id: entryId,
				patch: { status: "failed", error, elapsedMs: Date.now() - startedAt },
			});
			return { ok: false, error };
		}
		try {
			const result = await tool.execute(call.args);
			const error = errorOf(result);
			entries.patched({
				id: entryId,
				patch: error
					? { status: "failed", result, error, elapsedMs: Date.now() - startedAt }
					: { status: "completed", result, elapsedMs: Date.now() - startedAt },
			});
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			entries.patched({
				id: entryId,
				patch: {
					status: "failed",
					error: message,
					elapsedMs: Date.now() - startedAt,
				},
			});
			return { ok: false, error: message };
		}
	};

	/** One streamed exchange; returns the calls the model wants run next. */
	const exchange = async (
		blocks: ChatBlock[],
	): Promise<Array<StepToolCall & { id: string }>> => {
		const tools = [...$tools.getState().values()].map(
			({ execute: _execute, ...spec }) => spec,
		);
		const calls: Array<StepToolCall & { id: string }> = [];
		let answerId: string | undefined;
		let tokens: number | undefined;

		for await (const event of driver.send({ blocks, tools })) {
			switch (event.type) {
				case "text.delta": {
					// Created on the first token: a tool-only round leaves no empty
					// bubble behind.
					if (!answerId) {
						answerId = id();
						append({
							id: answerId,
							at: Date.now(),
							streams: [CONVERSATION, answerStream],
							kind: "assistant",
							text: "",
							model,
							streaming: true,
						});
					}
					entries.textAppended({ id: answerId, delta: event.text });
					break;
				}
				case "tool_call.ready":
					calls.push({ id: event.callId, name: event.name, args: event.args });
					break;
				case "usage":
					tokens = event.outputTokens ?? tokens;
					break;
				case "response.completed":
					if (answerId) {
						entries.patched({
							id: answerId,
							patch: {
								streaming: false,
								tokens,
								finishReason: event.finishReason,
							},
						});
					}
					return wantsTools(event.finishReason) ? calls : [];
				case "response.error":
					if (answerId) {
						entries.patched({ id: answerId, patch: { streaming: false } });
					}
					throw new Error(event.message);
			}
		}
		return [];
	};

	const send = async (text: string): Promise<void> => {
		turn.turnStarted();
		append({
			id: id(),
			at: Date.now(),
			streams: [CONVERSATION],
			kind: "user",
			text,
		});

		try {
			const plan = await runSteps(text);
			const fact = factOf(plan);

			const system = systemSent ? undefined : await systemPrompt?.();
			if (system) systemSent = true;

			let blocks: ChatBlock[] = [
				...(system ? [{ type: "system" as const, data: system }] : []),
				{ type: "text" as const, data: text },
				...(fact ? [{ type: "text" as const, data: `Function result:\n${fact}` }] : []),
			];

			for (;;) {
				const calls = await exchange(blocks);
				if (calls.length === 0) return;

				const admitted: Array<StepToolCall & { id: string }> = [];
				let stopped = false;
				for (const call of calls) {
					const reason = turn.screen(call);
					if (reason === null) {
						turn.callAdmitted(call);
						admitted.push(call);
						continue;
					}
					if (reason === "duplicate") continue;
					// The card is closed with the reason and the turn ends; the model
					// is deliberately left without a tool result, which is what breaks
					// the loop.
					append({
						id: id(),
						at: Date.now(),
						streams: [CONVERSATION],
						kind: "call",
						name: call.name,
						callId: call.id,
						args: call.args,
						status: "failed",
						error: loopMessage(reason, call, turn.budget),
					});
					console.warn("[orchestrator] tool-call loop stopped", {
						reason,
						call: call.name,
						args: call.args,
					});
					stopped = true;
				}
				if (stopped || admitted.length === 0) return;

				const results = await Promise.all(
					admitted.map(async (call) => ({ call, result: await execute(call) })),
				);
				blocks = results.map(({ call, result }) => ({
					type: "tool_result" as const,
					tool_call_id: call.id,
					data:
						typeof result === "string" ? result : JSON.stringify(result, null, 2),
				}));
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			append({
				id: id(),
				at: Date.now(),
				streams: [CONVERSATION],
				kind: "assistant",
				text: `Error: ${message}`,
				streaming: false,
				local: true,
			});
			failed(message);
		} finally {
			turn.turnFinished();
		}
	};

	return {
		domain,
		entries,
		catalog,
		turn,
		$tools,
		toolRegistered,
		failed,
		send,
		registerTool: (tool) => toolRegistered(tool),
		invokeTool: (name, args) => execute({ id: id(), name, args }),
		plan: runSteps,
	};
}
