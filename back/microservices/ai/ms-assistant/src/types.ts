import {
  type Tool,
  type ContentBlock,
  type StreamEvent,
  type ConversationOptions,
  type AssistantService,
  type PaginationParams,
  type PaginatedResult,
  type Chat,
  type ChatContext,
  type ChatContextSummary,
} from "g-assistant";

export enum ServiceType {
  OPENAI = "openai",
  ANTHROPIC = "anthropic",
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
}

export enum MessageSource {
  USER = "user",
  ASSISTANT = "assistant",
}

export {
  type Tool,
  type ContentBlock,
  type StreamEvent,
  type ConversationOptions,
  type AssistantService,
  type PaginationParams,
  type PaginatedResult,
  type Chat,
  type ChatContext,
  type ChatContextSummary,
};

export interface LogFunction {
  (message: any, type: MessageSource): Promise<void>;
}

export interface AiConversation {
  getId(): string;
  send(
    messages: ContentBlock[],
    options?: ConversationOptions,
  ): AsyncIterable<StreamEvent>;
}

export interface ConversationFactory {
  create(
    serviceType: ServiceType,
    model: string,
    log: LogFunction,
  ): AiConversation;
}

export abstract class EventHandler {
  abstract canHandle(eventType: string): boolean;
  abstract handle(event: any, totalTokens: number): StreamEvent | null;
}
