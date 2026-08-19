import {
	type AssistantConversationOptions,
	type RuntimeAssistantService,
	ServiceType,
	type StreamEvent,
	StreamEventType,
} from "./types";

export type AssistantEnvelope = {
	kind: "request";
	requestId: string;
	to: { target: string; service: string };
	method: string;
	codec: "json";
	deadlineMs: number;
	payload: unknown;
};

export type AssistantSignalChannel = {
	requestEnvelopeStream(
		message: AssistantEnvelope,
	): AsyncIterable<{ payload?: unknown }>;
};

export type SignalAssistantOptions = {
	target?: string;
	deadlineMs?: number;
	sessionId?: string;
};

type ContentBlock = {
	type: string;
	data?: unknown;
	toolCallId?: string;
	tool_call_id?: string;
};

type SessionConfig = {
	provider?: string;
	model?: string;
	contextName?: string;
	language?: string;
};

type ChatStreamEvent = {
	type?: unknown;
	text?: unknown;
	callId?: unknown;
	name?: unknown;
	arguments?: unknown;
	finishReason?: unknown;
	message?: unknown;
	outputTokens?: unknown;
};

const DEFAULT_TARGET = "resonus";
const DEFAULT_DEADLINE_MS = 120_000;

function providerName(serviceType?: ServiceType): string | undefined {
	if (serviceType === ServiceType.ANTHROPIC) return "claude";
	return serviceType;
}

export function createSignalAssistantClient(
	channel: AssistantSignalChannel,
	options: SignalAssistantOptions = {},
): RuntimeAssistantService {
	const target = options.target ?? DEFAULT_TARGET;
	const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
	const sessions = new Map<string, SessionConfig>();

	async function* sendMessage(
		sessionId: string,
		messages: ContentBlock[],
		conversationOptions: AssistantConversationOptions = {},
	): AsyncIterable<StreamEvent> {
		const session = sessions.get(sessionId) ?? {};
		let outputTokens: number | undefined;
		const stream = channel.requestEnvelopeStream({
			kind: "request",
			requestId: crypto.randomUUID(),
			to: { target, service: target },
			method: "chat.message",
			codec: "json",
			deadlineMs,
			payload: {
				sessionId,
				messages,
				options: conversationOptions,
				provider: session.provider,
				model: session.model,
				contextName: session.contextName,
				language: session.language,
			},
		});

		for await (const reply of stream) {
			const event = (reply.payload ?? {}) as ChatStreamEvent;
			switch (event.type) {
				case "text.delta":
					if (typeof event.text === "string" && event.text) {
						yield {
							type: StreamEventType.TEXT_DELTA,
							content: event.text,
							tokens: outputTokens,
						};
					}
					break;
				case "tool_call.ready":
					if (
						typeof event.callId === "string" &&
						typeof event.name === "string"
					) {
						yield {
							type: StreamEventType.TOOL_CALL,
							id: event.callId,
							name: event.name,
							args:
								event.arguments && typeof event.arguments === "object"
									? (event.arguments as Record<string, unknown>)
									: {},
						};
					}
					break;
				case "usage":
					if (typeof event.outputTokens === "number")
						outputTokens = event.outputTokens;
					break;
				case "response.completed": {
					const finishReason =
						typeof event.finishReason === "string"
							? event.finishReason
							: "stop";
					yield {
						type: StreamEventType.COMPLETED,
						finishReason:
							finishReason === "tool_use" ? "tool_calls" : finishReason,
						tokens: outputTokens,
					};
					return;
				}
				case "response.error":
					yield {
						type: StreamEventType.ERROR,
						message:
							typeof event.message === "string"
								? event.message
								: "AI stream failed",
					};
					return;
			}
		}

		throw new Error("AI stream ended without response.completed");
	}

	return {
		async createSession(
			serviceType?: ServiceType,
			model?: string,
			contextName?: string,
			language?: string,
		): Promise<string> {
			const id = options.sessionId ?? crypto.randomUUID();
			sessions.set(id, {
				provider: providerName(serviceType),
				model,
				contextName,
				language,
			});
			return id;
		},
		sendMessage,
	} as RuntimeAssistantService;
}
