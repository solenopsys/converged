import type { ThreadsService } from "../../../../../tools/types/services/communications/threads";
import { MessageType } from "../../../../../tools/types/services/communications/threads";


export enum ServiceType {
	OPENAI = "openai",
	ANTHROPIC = "anthropic",
	GEMINI = "gemini",
}

export enum StreamEventType {
	TEXT_DELTA = "text_delta",
	TOOL_CALL = "tool_call",
	COMPLETED = "completed",
	TOOL_CALL_DELTA = "tool_call_delta",
	ERROR = "error",
}

export enum ContentType {
	TEXT = "text",
	TOOL_RESULT = "tool_result",
	ATTACHMENT = "attachment",

	SYSTEM = "system",
}

export type ContentBlock = {
	type: ContentType;
	data?: unknown;
};

export type ToolParameter = {
	type: "string" | "number" | "boolean" | "object" | "array";
	description: string;
	required?: boolean;
	enum?: Array<string | number>;
	items?: ToolParameter;
	properties?: Record<string, ToolParameter>;
};

export type Tool = {
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<string, ToolParameter>;
		required?: string[];
	};
};

export type ToolCall = {
	id: string;
	name: string;
	args: Record<string, unknown>;
};


export type SendMessagePayload = {
	content: string;

	fact?: string;

};

/**
 * Options of the legacy streaming client. The engine's own options are
 * `ConversationOptions` in `orchestrator`; these two are different things and
 * must not share a name.
 */
export type AssistantConversationOptions = {
	stream?: boolean;
	tools?: Tool[];
	temperature?: number;
	maxTokens?: number;
};

export type StreamEvent =
	| { type: StreamEventType.TEXT_DELTA; content: string; tokens?: number }
	| {
			type: StreamEventType.TOOL_CALL;
			id: string;
			name: string;
			args: Record<string, unknown>;
			tokens?: number;
	  }
	| { type: StreamEventType.COMPLETED; finishReason?: string; tokens?: number }
	| { type: StreamEventType.ERROR; message: string; tokens?: number };

export type RuntimeAssistantService = {
	createSession(
		serviceType?: ServiceType,
		model?: string,
		contextName?: string,
		language?: string,
	): Promise<string>;
	sendMessage(
		sessionId: string,
		messages: ContentBlock[],
		options?: AssistantConversationOptions,
	): AsyncIterable<StreamEvent>;
};

export type ULID = string;

export type ChatMessage = {
	id: string;
	beforeId?: string;
	type: "user" | "assistant";
	content: string;
	timestamp: number;
	toolCallData?: {
		toolCallId?: string;
		title: string;
		status?: "running" | "completed" | "failed";
		summary?: string;
		details?: Record<string, unknown> | unknown[] | string;
	};
	fileData?: {
		fileId: string;
		fileName: string;
		fileSize?: number;
		fileType?: string;
	};
};

export type ChatState = {
	threadId: ULID;
	serviceType?: ServiceType;
	model?: string;
	contextName?: string;
	language?: string;
	sessionId?: string;
	messages: ChatMessage[];
	isLoading: boolean;
	currentResponse: string;
	turnStartedAt?: number;
	firstResponseAt?: number;
	pendingToolCalls: ToolCall[];
	lastToolCallName?: string;
};

export type ChatMetadataService = {
	recordChatMessage(threadId: string): Promise<unknown>;
};


export type SystemPromptResolver = (
	state: Pick<ChatState, "contextName" | "language">,
) => Promise<string | undefined> | string | undefined;

// Defined once, in the engine that runs them: a host tool is the spec the model
// sees plus the code behind it.
export type { ExecutableTool } from "orchestrator";

export { MessageType, type ThreadsService };
