import {
  ContentBlock,
  ConversationOptions,
  ServiceType,
  StreamEvent,
  ChatContext,
  ChatContextSummary,
} from "./types";
import { SimpleConversationFactory } from "./impls/factory";
import { PaginationParams, PaginatedResult, Chat } from "./types";
import { LogFunction } from "./types";
import { ConversationFactory } from "./types";
import { AiConversation } from "./types";
import { StoresController } from "./stores";

const MS_ID = "assistant-ms";

const logFunction: LogFunction = async (_message, _type) => {};

type AiConfig = {
  key: string;
  model: string;
};

class ChatsServiceImpl {
  private factory: ConversationFactory;
  private conversations: Map<string, AiConversation> = new Map();
  private serviceModelMap = new Map<ServiceType, string>();
  private stores: StoresController;

  constructor(config: { openai: AiConfig; claude: AiConfig }) {
    this.factory = new SimpleConversationFactory({
      openaiApiKey: config.openai.key,
      anthropicApiKey: config.claude.key,
    });
    this.serviceModelMap.set(ServiceType.OPENAI, config.openai.model);
    this.serviceModelMap.set(ServiceType.ANTHROPIC, config.claude.model);

    this.init();
  }

  async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
  }

  async createSession(
    serviceType: ServiceType,
    model?: string,
  ): Promise<string> {
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
      console.error(`[ChatsService] Session not found: ${sessionId}`);
      throw new Error(`Conversation not found for sessionId: ${sessionId}`);
    }

    return conversation.send(messages, options);
  }

  async listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>> {
    const conversations = await this.stores.metadataService.conversationRepo.findAll({
      limit: params.limit,
      offset: params.offset,
      orderBy: [{ field: 'updatedAt', direction: 'desc' }]
    });

    const totalCount = await this.stores.metadataService.conversationRepo.count();

    const items: Chat[] = conversations.map(conv => ({
      id: conv.id,
      name: conv.title,
      description: `${conv.messagesCount} messages`
    }));

    return { items, totalCount };
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
