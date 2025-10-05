import { AiChatService, ContentBlock, ConversationOptions, ServiceType, StreamEvent } from "./types";
import { SimpleConversationFactory } from "./impls/factory";
import { PaginationParams, PaginatedResult, Chat } from "./types";
import { LogFunction } from "./types";
import { ConversationFactory } from "./types";
import { AiConversation } from "./types";
import { StoresController } from "./stores";

const logFunction: LogFunction = async (message, type) => {
    console.log(`[${type}]`, message);
};

type AiConfig = {
    key: string,
    model: string
}

class ChatsServiceImpl implements AiChatService {
    private factory: ConversationFactory;
    private conversations: Map<string, AiConversation> = new Map();
    private serviceModelMap = new Map<ServiceType, string>();
    private stores;

    constructor(config: { openai: AiConfig, claude: AiConfig }) {
        console.log(`[ChatsService] Init: OpenAI(${config.openai.model}), Claude(${config.claude.model})`);
        
        this.factory = new SimpleConversationFactory({
            openaiApiKey: config.openai.key,
            anthropicApiKey: config.claude.key
        });
        this.serviceModelMap.set(ServiceType.OPENAI, config.openai.model);
        this.serviceModelMap.set(ServiceType.ANTHROPIC, config.claude.model);
     
        this.init();
     }
 
     async init(){
         this.stores = new StoresController("threads-ms");
         await this.stores.init();
     }

    async createSession(serviceType: ServiceType, model?: string): Promise<string> {
        if (!model) {
            model = this.serviceModelMap.get(serviceType);
            if (!model) {
                console.error(`[ChatsService] No model for ${serviceType}`);
                throw new Error(`Model not found for service type: ${serviceType}`);
            }
        }
        
        const conversation = this.factory.create(serviceType, model, logFunction);
        const sessionId = conversation.getId();
        this.conversations.set(sessionId, conversation);
        
        console.log(`[ChatsService] Session created: ${sessionId} (${serviceType}), total: ${this.conversations.size}`);
        return sessionId;
    }

    sendMessage(sessionId: string, messages: ContentBlock[], options?: ConversationOptions): AsyncIterable<StreamEvent> {
        const conversation = this.conversations.get(sessionId);
        if (!conversation) {
            console.error(`[ChatsService] Session not found: ${sessionId}`);
            throw new Error(`Conversation not found for sessionId: ${sessionId}`);
        }
        
        console.log(`[ChatsService] Sending ${messages.length} messages to ${sessionId}`);
        return conversation.send(messages, options);
    }

    listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>> {
        console.log(`[ChatsService] List chats:`, params);
        return Promise.resolve({ items: [] });
    }

    deleteChat(chatId: string): Promise<void> {
        console.log(`[ChatsService] Delete chat: ${chatId}`);
        return Promise.resolve();
    }

    getChat(chatId: string): Promise<Chat> {
        console.log(`[ChatsService] Get chat: ${chatId}`);
        return Promise.resolve({ id: chatId, name: "Chat", description: "Chat" });
    }
}

export default ChatsServiceImpl;