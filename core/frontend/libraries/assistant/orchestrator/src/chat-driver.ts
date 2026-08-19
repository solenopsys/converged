import type { ResonusCommandTransport } from "./resonus-session";
import type { ToolSpec } from "./types";

// The conversational half of a turn: one streamed exchange with the model.
// Both hosts spoke this protocol already — the CLI parsed the stream by hand and
// the browser had its own client — so it lives here once, normalized, and the
// engine never sees a vendor event.

export type ChatBlock = {
	type: "text" | "tool_result" | "system";
	data: string;
	tool_call_id?: string;
};

export type ChatEvent =
	| { type: "text.delta"; text: string }
	| {
			type: "tool_call.ready";
			callId: string;
			name: string;
			args: Record<string, unknown>;
	  }
	| { type: "usage"; inputTokens?: number; outputTokens?: number }
	| { type: "response.completed"; finishReason: string }
	| { type: "response.error"; message: string };

export type ChatDriver = {
	send(input: {
		blocks: ChatBlock[];
		tools: ToolSpec[];
	}): AsyncIterable<ChatEvent>;
};

export type ResonusChatDriverOptions = {
	transport: ResonusCommandTransport;
	sessionId: string;
	provider?: string;
	model?: string;
	contextName?: string;
	language?: string;
};

type RawEvent = {
	type?: unknown;
	text?: unknown;
	callId?: unknown;
	name?: unknown;
	arguments?: unknown;
	finishReason?: unknown;
	inputTokens?: unknown;
	outputTokens?: unknown;
	message?: unknown;
};

const asNumber = (value: unknown): number | undefined =>
	typeof value === "number" ? value : undefined;

function normalize(raw: unknown): ChatEvent | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const event = raw as RawEvent;
	switch (event.type) {
		case "text.delta":
			return typeof event.text === "string" && event.text
				? { type: "text.delta", text: event.text }
				: undefined;
		case "tool_call.ready":
			return typeof event.callId === "string" && typeof event.name === "string"
				? {
						type: "tool_call.ready",
						callId: event.callId,
						name: event.name,
						args:
							event.arguments && typeof event.arguments === "object"
								? (event.arguments as Record<string, unknown>)
								: {},
					}
				: undefined;
		case "usage":
			return {
				type: "usage",
				inputTokens: asNumber(event.inputTokens),
				outputTokens: asNumber(event.outputTokens),
			};
		case "response.completed":
			return {
				type: "response.completed",
				finishReason:
					typeof event.finishReason === "string" ? event.finishReason : "stop",
			};
		case "response.error":
			return {
				type: "response.error",
				message:
					typeof event.message === "string" ? event.message : "AI stream failed",
			};
		default:
			return undefined;
	}
}

/** `finishReason` naming differs per vendor; the engine only knows one word. */
export const wantsTools = (finishReason: string): boolean =>
	finishReason === "tool_calls" || finishReason === "tool_use";

export function createResonusChatDriver({
	transport,
	sessionId,
	provider,
	model,
	contextName,
	language,
}: ResonusChatDriverOptions): ChatDriver {
	return {
		async *send({ blocks, tools }): AsyncIterable<ChatEvent> {
			const stream = transport.stream("chat.message", {
				sessionId,
				messages: blocks,
				options: tools.length > 0 ? { tools } : {},
				provider,
				model,
				contextName,
				language,
			});
			for await (const raw of stream) {
				const event = normalize(raw);
				if (!event) continue;
				yield event;
				if (
					event.type === "response.completed" ||
					event.type === "response.error"
				) {
					return;
				}
			}
			throw new Error("AI stream ended without response.completed");
		},
	};
}
