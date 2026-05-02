import {
  ContentBlock,
  ConversationOptions,
  ServiceType,
  StreamEvent,
  ChatContext,
  ChatContextSummary,
} from "./types";
import { SimpleConversationFactory } from "rt-chat";
import { PaginationParams, PaginatedResult, Chat } from "./types";
import { LogFunction } from "./types";
import { ConversationFactory } from "./types";
import { AiConversation } from "./types";
import { StoresController } from "./stores";

const MS_ID = "assistant-ms";

const logFunction: LogFunction = async (_message, _type) => {};

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

class ChatsServiceImpl {
  private factory: ConversationFactory;
  private conversations: Map<string, AiConversation> = new Map();
  private serviceModelMap = new Map<ServiceType, string>();
  private defaultServiceType?: ServiceType;
  private defaultModel?: string;
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor(config: { openai: AiConfig; claude: AiConfig; gemini?: AiConfig }) {
    this.factory = new SimpleConversationFactory({
      openaiApiKey: config.openai.key,
      anthropicApiKey: config.claude.key,
      geminiApiKey: config.gemini?.key,
    });
    this.serviceModelMap.set(ServiceType.OPENAI, config.openai.model);
    this.serviceModelMap.set(ServiceType.ANTHROPIC, config.claude.model);
    if (config.gemini) {
      this.serviceModelMap.set(ServiceType.GEMINI, config.gemini.model);
    }
    this.defaultServiceType = resolveServiceType(process.env[CHAT_PROVIDER_ENV]);
    this.defaultModel = process.env[CHAT_MODEL_ENV]?.trim() || undefined;

    this.init();
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  async createSession(
    serviceType?: ServiceType,
    model?: string,
  ): Promise<string> {
    serviceType = this.defaultServiceType ?? serviceType ?? ServiceType.OPENAI;
    model = this.defaultModel ?? model;

    if (!model) {
      model = this.serviceModelMap.get(serviceType);
      if (!model) {
        console.error(`[ChatsService] No model for ${serviceType}`);
        throw new Error(`Model not found for service type: ${serviceType}`);
      }
    }

    const conversation = this.factory.create(serviceType, model, logFunction);
    const sessionId = conversation.getId();
    await this.stores.metadataService.createConversation(
      sessionId,
      "conversation" + sessionId,
    );
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
      console.error(
        `[ChatsService] Session not found: ${sessionId}. Session cache may be cleared after restart.`,
      );
      throw new Error(
        `SESSION_NOT_FOUND: Conversation not found for sessionId: ${sessionId}`,
      );
    }

    return conversation.send(messages, options);
  }

  private toChat(conversation: {
    id: string;
    title: string;
    messagesCount: number | string;
    filesCount?: number | string;
    filesSize?: number | string;
    createdAt: number | string;
    updatedAt: number | string;
  }): Chat {
    return {
      id: conversation.id,
      name: conversation.title,
      threadId: conversation.id,
      description: conversation.title,
      messagesCount: Number(conversation.messagesCount ?? 0),
      filesCount: Number(conversation.filesCount ?? 0),
      filesSize: Number(conversation.filesSize ?? 0),
      createdAt: Number(conversation.createdAt),
      updatedAt: Number(conversation.updatedAt),
    };
  }

  async listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>> {
    const conversations = await this.stores.metadataService.conversationRepo.findAll({
      limit: params.limit,
      offset: params.offset,
      orderBy: [{ field: 'updatedAt', direction: 'desc' }]
    });

    const totalCount = await this.stores.metadataService.conversationRepo.count();

    const items: Chat[] = conversations.map((conv) => this.toChat(conv));

    return { items, totalCount };
  }

  async registerChat(threadId: string, title?: string): Promise<Chat> {
    await this.init();
    const conversation = await this.stores.metadataService.registerConversation(
      threadId,
      title || `Chat ${threadId.slice(0, 8)}`,
    );

    return this.toChat(conversation);
  }

  async recordChatMessage(threadId: string): Promise<Chat> {
    await this.init();
    const conversation = await this.stores.metadataService.recordMessage(threadId);

    return this.toChat(conversation);
  }

  async recordChatFile(threadId: string, fileSize?: number): Promise<Chat> {
    await this.init();
    const conversation = await this.stores.metadataService.recordFile(threadId, fileSize);

    return this.toChat(conversation);
  }

  deleteChat(chatId: string): Promise<void> {
    return Promise.resolve();
  }

  getChat(chatId: string): Promise<Chat> {
    return Promise.resolve({ id: chatId, name: "Chat", description: "Chat" });
  }

  async saveContext(
    chatId: string,
    context: any,
  ): Promise<ChatContextSummary> {
    return this.stores.contextService.saveContext(chatId, context);
  }

  async getContext(chatId: string): Promise<ChatContext | null> {
    return this.stores.contextService.getContext(chatId);
  }

  async listContexts(
    params: PaginationParams,
  ): Promise<PaginatedResult<ChatContextSummary>> {
    return this.stores.contextService.listContexts(params);
  }
}

export default ChatsServiceImpl;
