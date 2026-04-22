import {
  type Chat,
  type ChatContext,
  type ChatContextSummary,
  type ContentBlock,
  type ConversationOptions,
  type LogFunction,
  MessageSource,
  type PaginatedResult,
  type PaginationParams,
  ServiceType,
  type StreamEvent,
} from "./types";
import { SimpleConversationFactory } from "./impls/factory";
import type { AiConversation } from "./types";

type AiConfig = {
  key?: string;
  model?: string;
};

const CHAT_PROVIDER_ENV = "CHAT_PROVIDER";
const CHAT_MODEL_ENV = "CHAT_MODEL";

function resolveServiceType(value?: string): ServiceType | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "openai" || normalized === "gpt") return ServiceType.OPENAI;
  if (normalized === "claude" || normalized === "anthropic") return ServiceType.ANTHROPIC;
  if (normalized === "gemini" || normalized === "gemin" || normalized === "google") return ServiceType.GEMINI;
  throw new Error(
    `Unsupported ${CHAT_PROVIDER_ENV}: ${value}. Expected one of: openai, claude, anthropic, gemini`,
  );
}

export class ChatRuntimeService {
  private factory: SimpleConversationFactory;
  private conversations = new Map<string, AiConversation>();
  private serviceModelMap = new Map<ServiceType, string | undefined>();
  private defaultServiceType?: ServiceType;
  private defaultModel?: string;
  private logFunction: LogFunction = async (_message, _type = MessageSource.ASSISTANT) => {};

  constructor(config: { openai?: AiConfig; claude?: AiConfig; gemini?: AiConfig } = {}) {
    this.factory = new SimpleConversationFactory({
      openaiApiKey: config.openai?.key || process.env.OPENAI_API_KEY,
      anthropicApiKey:
        config.claude?.key ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.CLAUDE_API_KEY,
      geminiApiKey: config.gemini?.key || process.env.GEMINI_API_KEY,
    });
    this.serviceModelMap.set(ServiceType.OPENAI, config.openai?.model || process.env.OPENAI_MODEL);
    this.serviceModelMap.set(ServiceType.ANTHROPIC, config.claude?.model || process.env.CLAUDE_MODEL);
    this.serviceModelMap.set(ServiceType.GEMINI, config.gemini?.model || process.env.GEMINI_MODEL);
    this.defaultServiceType = resolveServiceType(process.env[CHAT_PROVIDER_ENV]);
    this.defaultModel = process.env[CHAT_MODEL_ENV]?.trim() || undefined;
  }

  async createSession(serviceType?: ServiceType, model?: string): Promise<string> {
    serviceType = this.defaultServiceType ?? serviceType ?? ServiceType.OPENAI;
    model = this.defaultModel ?? model ?? this.serviceModelMap.get(serviceType);
    if (!model) {
      throw new Error(`Model not found for service type: ${serviceType}`);
    }

    const conversation = this.factory.create(serviceType, model, this.logFunction);
    const sessionId = conversation.getId();
    this.conversations.set(sessionId, conversation);
    return sessionId;
  }

  sendMessage(
    sessionId: string,
    messages: ContentBlock[],
    options?: ConversationOptions,
  ): AsyncIterable<StreamEvent> {
    const conversation = this.conversations.get(sessionId);
    if (!conversation) {
      throw new Error(`SESSION_NOT_FOUND: Conversation not found for sessionId: ${sessionId}`);
    }
    return conversation.send(messages, options);
  }

  async listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>> {
    const items = Array.from(this.conversations.keys())
      .slice(params.offset, params.offset + params.limit)
      .map((id) => ({ id, name: `conversation${id}`, description: "runtime session" }));
    return { items, totalCount: this.conversations.size };
  }

  async deleteChat(chatId: string): Promise<void> {
    this.conversations.delete(chatId);
  }

  async getChat(chatId: string): Promise<Chat> {
    return { id: chatId, name: `conversation${chatId}`, description: "runtime session" };
  }

  async saveContext(chatId: string, _context: any): Promise<ChatContextSummary> {
    return { id: chatId, chatId, updatedAt: Date.now(), size: 0 };
  }

  async getContext(_chatId: string): Promise<ChatContext | null> {
    return null;
  }

  async listContexts(_params: PaginationParams): Promise<PaginatedResult<ChatContextSummary>> {
    return { items: [], totalCount: 0 };
  }
}
