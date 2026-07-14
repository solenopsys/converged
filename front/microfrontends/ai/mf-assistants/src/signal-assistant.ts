import {
	type ConversationOptions,
	type RuntimeAssistantService,
	ServiceType,
	type StreamEvent,
	StreamEventType,
} from "assistant-state";
import { signalChannel } from "front-core/signal";

type ContentBlock = {
	type: string;
	data?: unknown;
	toolCallId?: string;
	tool_call_id?: string;
};

type SessionConfig = {
	provider: string;
	model?: string;
	contextName?: string;
	language?: string;
};

type ChatResult = {
	text?: unknown;
	toolCalls?: Array<{ id?: unknown; name?: unknown; args?: unknown }>;
	finishReason?: unknown;
	usage?: { output?: unknown };
};

const sessions = new Map<string, SessionConfig>();

function providerName(serviceType?: ServiceType): string {
	if (serviceType === ServiceType.ANTHROPIC) return "claude";
	return serviceType ?? "openai";
}

async function* sendMessage(
	sessionId: string,
	messages: ContentBlock[],
	options: ConversationOptions = {},
): AsyncIterable<StreamEvent> {
	const session = sessions.get(sessionId) ?? { provider: "openai" };
	const response = await signalChannel.request(
		"centimanus",
		"chat.message",
		{
			sessionId,
			messages,
			options,
			provider: session.provider,
			model: session.model,
			contextName: session.contextName,
			language: session.language,
		},
		120_000,
	);
	if (response.name !== "chat.result") {
		throw new Error(
			`Unexpected chat response: ${response.name ?? response.type}`,
		);
	}

	const result = (response.payload ?? {}) as ChatResult;
	const tokens =
		typeof result.usage?.output === "number" ? result.usage.output : undefined;
	if (typeof result.text === "string" && result.text) {
		yield { type: StreamEventType.TEXT_DELTA, content: result.text, tokens };
	}
	for (const toolCall of result.toolCalls ?? []) {
		if (typeof toolCall.id !== "string" || typeof toolCall.name !== "string") {
			continue;
		}
		yield {
			type: StreamEventType.TOOL_CALL,
			id: toolCall.id,
			name: toolCall.name,
			args:
				toolCall.args && typeof toolCall.args === "object" ? toolCall.args : {},
		};
	}
	yield {
		type: StreamEventType.COMPLETED,
		finishReason:
			typeof result.finishReason === "string" ? result.finishReason : "stop",
		tokens,
	};
}

export const signalAssistantClient = {
	async createSession(
		serviceType?: ServiceType,
		model?: string,
		contextName?: string,
		language?: string,
	): Promise<string> {
		const id = crypto.randomUUID();
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
