export enum StreamEventType {
    TEXT_DELTA = "text_delta",
    TOOL_CALL = "tool_call",
    COMPLETED = "completed",
    TOOL_CALL_DELTA = "tool_call_delta",  // Новый тип для частичных данных инструментов

    ERROR = "error"
}

export enum ServiceType {
    OPENAI = "openai",
    ANTHROPIC = "anthropic",
    GEMINI = "gemini"
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

export type ToolParameter = {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required?: boolean;
    enum?: (string | number)[];
    items?: ToolParameter;
    properties?: Record<string, ToolParameter>;
}

export type Tool = {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, ToolParameter>;
        required?: string[];
    };

    execute: (args: any) => Promise<any> | any;
}

export type ToolCall = {
    id: string;
    name: string;
    args: Record<string, any>;
}

export type ToolResult = {
    toolCallId: string;
    result: any;
    error?: string;
}

export type ConversationOptions = {
    stream?: boolean;
    tools?: Tool[];
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

export type PaginationParams = {
    offset: number;
    limit: number;
}

export type PaginatedResult<T> = {
    items: T[];
    totalCount?: number; // если хочешь знать общее число
}

export type Chat = {
    id: string;
    name: string;
    description: string;
    threadId?: string;
    messagesCount?: number;
    filesCount?: number;
    filesSize?: number;
    createdAt?: number;
    updatedAt?: number;
}

export type ChatContextSummary = {
    id: string;
    chatId: string;
    updatedAt: number;
    size?: number;
}

export type ChatContext = ChatContextSummary & {
    data: any;
}

export interface AssistantService {
    createSession(serviceType?: ServiceType, model?: string ): Promise<string>;
    sendMessage(sessionId: string, messages: ContentBlock[], options?: ConversationOptions): AsyncIterable<StreamEvent>;

    listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>>;
    registerChat(threadId: string, title?: string): Promise<Chat>;
    recordChatMessage(threadId: string): Promise<Chat>;
    recordChatFile(threadId: string, fileSize?: number): Promise<Chat>;
    deleteChat(chatId: string): Promise<void>;
    getChat(chatId: string): Promise<Chat>;

    saveContext(chatId: string, context: any): Promise<ChatContextSummary>;
    getContext(chatId: string): Promise<ChatContext | null>;
    listContexts(params: PaginationParams): Promise<PaginatedResult<ChatContextSummary>>;
}
