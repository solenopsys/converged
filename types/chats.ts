export enum StreamEventType {
    TEXT_DELTA = "text_delta",
    TOOL_CALL = "tool_call",
    COMPLETED = "completed",
    ERROR = "error"
}

export enum ServiceType {
    OPENAI = "openai",
    ANTHROPIC = "anthropic"
}

export enum ContentType {
    TEXT = "text",
    TOOL_RESULT = "tool_result",
    ATTACHMENT = "attachment"
}

export type ContentBlock = {
    type: ContentType;
    data?: any;
};

export type ConversationOptions = {
    stream?: boolean;
    tools?: any[];
    temperature?: number;
    maxTokens?: number;
}

export type StreamEvent = {
    tokens?: number;
} & (
    | { type: StreamEventType.TEXT_DELTA; content: string }
    | { type: StreamEventType.TOOL_CALL; id: string; name: string; args: any }
    | { type: StreamEventType.COMPLETED; finishReason?: string }
    | { type: StreamEventType.ERROR; message: string }
);

export enum MessageSource {
    USER = "user",
    ASSISTANT = "assistant"
}
 
export interface PaginationParams {
    offset: number;
    limit: number;
}

export interface PaginatedResult<T> {
    items: T[];
    totalCount?: number; // если хочешь знать общее число
}

export interface Chat {
    id: string;
    name: string;
    description: string;
    
}

export interface AiChatService {
    createSession(serviceType: ServiceType, model: string ): Promise<string>;
    sendMessage(sessionId: string, messages: ContentBlock[], options?: ConversationOptions): AsyncIterable<StreamEvent>;

    listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>>;
    deleteChat(chatId: string): Promise<void>;
    getChat(chatId: string): Promise<Chat>;
}


