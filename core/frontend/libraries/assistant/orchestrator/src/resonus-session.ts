import type { OneShotAsk, StepAnswer, Tier, ToolSpec } from "./types";

export type ResonusCommandTransport = {
	command(method: string, payload: Record<string, unknown>): Promise<void>;
	stream(
		method: string,
		payload: Record<string, unknown>,
	): AsyncIterable<unknown>;
};

export type ResonusSessionOptions = {
	transport: ResonusCommandTransport;
	sessionId?: string;
	endpoint?: string;
	endpointForTier?: (tier: Tier) => string;
	maxTokens?: number;
};

export type ResonusSession = {
	sessionId: string;
	start(): Promise<void>;
	ask: OneShotAsk;
	close(): Promise<void>;
};

type ControlStreamEvent = {
	type?: unknown;
	text?: unknown;
	name?: unknown;
	arguments?: unknown;
	message?: unknown;
};

const DEFAULT_ENDPOINT = "fast";
const DEFAULT_MAX_TOKENS = 256;

/**
 * Server-side session state Resonus can lose without this side noticing.
 *
 * A session is process-local there, while the socket goes to the signalling
 * peer in front of it: when the Resonus process behind that peer is replaced,
 * the browser keeps a perfectly healthy connection and an id nothing knows any
 * more. Neither of these is a failed turn — a session is an id and its endpoint
 * bindings, and the messages and context of a turn are re-sent by `ask` on
 * every call, so opening and binding again restores everything that was lost.
 */
const RECOVERABLE = ["SessionUnknown", "EndpointNotBound"];

function isRecoverable(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return RECOVERABLE.some((code) => message.includes(code));
}

function eventError(event: ControlStreamEvent): Error | undefined {
	if (event.type !== "response.error") return undefined;
	return new Error(
		typeof event.message === "string" ? event.message : "AI step failed",
	);
}

function applyEvent(answer: StepAnswer, value: unknown): void {
	if (!value || typeof value !== "object") return;
	const event = value as ControlStreamEvent;
	const error = eventError(event);
	if (error) throw error;
	if (event.type === "text.delta" && typeof event.text === "string") {
		answer.text += event.text;
		return;
	}
	if (event.type === "tool_call.ready" && typeof event.name === "string") {
		const call = {
			name: event.name,
			args:
				event.arguments && typeof event.arguments === "object"
					? (event.arguments as Record<string, unknown>)
					: {},
		};
		if (
			!answer.toolCalls.some(
				(candidate) =>
					candidate.name === call.name &&
					JSON.stringify(candidate.args) === JSON.stringify(call.args),
			)
		) {
			answer.toolCalls.push(call);
		}
	}
}

/**
 * Owns an explicit Resonus Session and short-lived Contexts for one host chat.
 * A context contains only one deciding step; endpoint bindings are reused by
 * session id, including when a turn selects more than one model tier.
 */
export function createResonusSession({
	transport,
	sessionId = crypto.randomUUID(),
	endpoint = DEFAULT_ENDPOINT,
	endpointForTier = (tier) => tier,
	maxTokens = DEFAULT_MAX_TOKENS,
}: ResonusSessionOptions): ResonusSession {
	const bindings = new Set<string>();
	let starting: Promise<void> | undefined;
	let closing = false;

	const bind = async (target: string): Promise<void> => {
		if (bindings.has(target)) return;
		await transport.command("session.bind", { sessionId, endpoint: target });
		bindings.add(target);
	};

	const start = (): Promise<void> => {
		if (!starting) {
			starting = (async () => {
				if (closing) throw new Error("Resonus session is closed");
				await transport.command("session.open", { sessionId });
				await bind(endpoint);
			})().catch((error: unknown) => {
				// An open that never happened must not be remembered as the
				// session's state: without this the first failure — a dropped
				// socket, a peer still starting — is replayed to every later
				// turn for as long as the page lives.
				starting = undefined;
				throw error;
			});
		}
		return starting;
	};

	/** Forget what the server no longer has, so the next `start` really opens. */
	const reset = (): void => {
		starting = undefined;
		bindings.clear();
	};

	const attempt: OneShotAsk = async ({ system, user, tier, tools }) => {
		await start();
		if (closing) throw new Error("Resonus session is closed");
		const target = endpointForTier(tier) || endpoint;
		await bind(target);

		const systemId = crypto.randomUUID();
		const inputId = crypto.randomUUID();
		const contextId = crypto.randomUUID();
		await transport.command("message.put", {
			messageId: systemId,
			message: { role: "system", content: system },
		});
		await transport.command("message.put", {
			messageId: inputId,
			message: { role: "user", content: user },
		});
		await transport.command("context.create", {
			contextId,
			revision: "1",
			messageIds: [systemId, inputId],
		});

		const answer: StepAnswer = { text: "", toolCalls: [] };
		try {
			for await (const event of transport.stream("llm.generate", {
				sessionId,
				endpoint: target,
				contextId,
				inputMessageId: inputId,
				tools,
				generation: { maxTokens },
			})) {
				applyEvent(answer, event);
			}
			return answer;
		} finally {
			await transport.command("context.delete", { contextId }).catch(() => {});
		}
	};

	const ask: OneShotAsk = async (input) => {
		try {
			return await attempt(input);
		} catch (error) {
			if (closing || !isRecoverable(error)) throw error;
			reset();
			return attempt(input);
		}
	};

	return {
		sessionId,
		start,
		ask,
		async close(): Promise<void> {
			if (closing) return;
			closing = true;
			if (starting) await starting.catch(() => {});
			// Closing a session the server has already forgotten is the state
			// the caller asked for, not an error to propagate out of teardown.
			await transport.command("session.close", { sessionId }).catch(() => {});
		},
	};
}
