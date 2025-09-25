


import { AiChatService, ContentBlock, ConversationOptions, ServiceType, StreamEvent } from "./types";
import { SimpleConversationFactory } from "./impls/factory";
import { PaginationParams, PaginatedResult, Chat } from "./types";
import { LogFunction } from "./types";
import { ConversationFactory } from "./types";
import { AiConversation } from "./types";
const logFunction: LogFunction = async (message, type) => {
    console.log(`[${type}]`, message);
};


class ChatsServiceImpl implements AiChatService {
    private factory: ConversationFactory;
    private conversations: Map<string, AiConversation> = new Map();
    constructor() {
        this.factory= new SimpleConversationFactory({
            openaiApiKey: process.env.OPENAI_API_KEY,
            anthropicApiKey: process.env.ANTHROPIC_API_KEY
        });
    }
    async createSession(serviceType: ServiceType, model: string): Promise<string> {
        const conversation = this.factory.create(serviceType, model, logFunction);
        this.conversations.set(conversation.getId(), conversation);
        return conversation.getId();
    }
    
     sendMessage(sessionId: string, messages: ContentBlock[], options?: ConversationOptions): AsyncIterable<StreamEvent> {
        const conversation = this.conversations.get(sessionId);
        if (!conversation) {
            throw new Error(`Conversation not found for sessionId: ${sessionId}`);
        }
        return conversation.send(messages, options);
    }

    listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>> {
        return Promise.resolve({ items: [] });
    }
    deleteChat(chatId: string): Promise<void> {
        return Promise.resolve();
    }
    getChat(chatId: string): Promise<Chat> {
        return Promise.resolve({ id: chatId, name: "Chat", description: "Chat" });
    }
}

export default ChatsServiceImpl;
