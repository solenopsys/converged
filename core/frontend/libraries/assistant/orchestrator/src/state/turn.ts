import { createDomain, type Domain, type EventCallable, type Store } from "effector";
import type { StepToolCall } from "../types";

// A turn is an exchange with the model, not an open-ended loop: every tool
// result is sent back, and the model may answer it with another call. A model
// that cannot see what its call did keeps calling, and the exchange never ends.
// Two ceilings close it: a budget over the whole turn, and a repeat count for
// one identical call. Hitting either ends the turn instead of answering the
// model, because answering is what starts the next round.

export const MAX_TOOL_ROUNDS = 8;
export const MAX_IDENTICAL_CALLS = 2;

export type TurnBudget = {
	maxRounds?: number;
	maxIdentical?: number;
};

export type LoopReason = "budget" | "repeat";

/** null admits the call, "duplicate" drops it silently, a reason ends the turn. */
export type Screening = LoopReason | "duplicate" | null;

export type TurnGuard = {
	rounds: number;
	signatures: string[];
	ids: string[];
};

export const emptyGuard: TurnGuard = { rounds: 0, signatures: [], ids: [] };

// Key order in streamed arguments is the vendor's business, so it must not make
// two identical calls look different.
const stableJson = (value: unknown): string =>
	JSON.stringify(value ?? {}, (_key, val) =>
		val && typeof val === "object" && !Array.isArray(val)
			? Object.fromEntries(
					Object.entries(val as Record<string, unknown>).sort(([a], [b]) =>
						a.localeCompare(b),
					),
				)
			: val,
	);

export const signatureOf = (call: { name: string; args: unknown }): string =>
	`${call.name}:${stableJson(call.args)}`;

export function screen(
	guard: TurnGuard,
	call: StepToolCall & { id?: string },
	budget: Required<TurnBudget>,
): Screening {
	// The same call id delivered twice is one call: counting redeliveries as
	// rounds would spend the budget on the transport.
	if (call.id && guard.ids.includes(call.id)) return "duplicate";
	if (guard.rounds >= budget.maxRounds) return "budget";
	const signature = signatureOf(call);
	const repeats = guard.signatures.filter((seen) => seen === signature).length;
	return repeats >= budget.maxIdentical ? "repeat" : null;
}

export function loopMessage(
	reason: LoopReason,
	call: { name: string },
	budget: Required<TurnBudget>,
): string {
	return reason === "budget"
		? `Turn stopped: ${budget.maxRounds} function calls without an answer.`
		: `Turn stopped: "${call.name}" was called ${budget.maxIdentical} times with the same arguments.`;
}

export type ConversationTurn = {
	domain: Domain;
	$guard: Store<TurnGuard>;
	/** Whether a turn is in flight — the flag every host's input reads. */
	$running: Store<boolean>;
	budget: Required<TurnBudget>;
	turnStarted: EventCallable<void>;
	turnFinished: EventCallable<void>;
	callAdmitted: EventCallable<StepToolCall & { id?: string }>;
	screen(call: StepToolCall & { id?: string }): Screening;
};

export function createConversationTurn(
	budget: TurnBudget = {},
	domain: Domain = createDomain("conversation-turn"),
): ConversationTurn {
	const limits: Required<TurnBudget> = {
		maxRounds: budget.maxRounds ?? MAX_TOOL_ROUNDS,
		maxIdentical: budget.maxIdentical ?? MAX_IDENTICAL_CALLS,
	};

	const turnStarted = domain.createEvent<void>("TURN_STARTED");
	const turnFinished = domain.createEvent<void>("TURN_FINISHED");
	const callAdmitted = domain.createEvent<StepToolCall & { id?: string }>(
		"CALL_ADMITTED",
	);

	// Counts only what actually ran: a call the guard refused must not push the
	// next one over the budget.
	const $guard = domain
		.createStore<TurnGuard>(emptyGuard, { name: "TURN_GUARD" })
		.reset(turnStarted)
		.on(callAdmitted, (guard, call) => ({
			rounds: guard.rounds + 1,
			signatures: [...guard.signatures, signatureOf(call)],
			ids: call.id ? [...guard.ids, call.id] : guard.ids,
		}));

	const $running = domain
		.createStore(false, { name: "TURN_RUNNING" })
		.on(turnStarted, () => true)
		.on(turnFinished, () => false);

	return {
		domain,
		$guard,
		$running,
		budget: limits,
		turnStarted,
		turnFinished,
		callAdmitted,
		screen: (call) => screen($guard.getState(), call, limits),
	};
}
