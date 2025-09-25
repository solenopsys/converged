import {type    ContentBlock, StreamEvent, ServiceType, ConversationOptions, StreamEventType, ContentType, AiChatService, PaginationParams, PaginatedResult, Chat, MessageSource } from "../../../../../types/chats";

export {MessageSource,  ContentBlock, StreamEvent, ServiceType, ConversationOptions, StreamEventType, ContentType, AiChatService, PaginationParams, PaginatedResult, Chat }


export interface LogFunction { 
    (message: any, type: MessageSource): Promise<void>;  
}
       
export interface AiConversation {
    getId(): string;
    send(
        messages: ContentBlock[],
        options?: ConversationOptions
    ): AsyncIterable<StreamEvent>;
}

export interface ConversationFactory {
    create(serviceType: ServiceType, model: string, log: LogFunction): AiConversation;
}


export abstract class EventHandler {
    abstract canHandle(eventType: string): boolean;
    abstract handle(event: any, totalTokens: number): StreamEvent | null;
}