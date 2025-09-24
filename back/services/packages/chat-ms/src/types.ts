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

// Исправил дублирование type
export type StreamEvent = {
    tokens?: number;
} & (
    | { type: StreamEventType.TEXT_DELTA; content: string }
    | { type: StreamEventType.TOOL_CALL; id: string; name: string; args: any }
    | { type: StreamEventType.COMPLETED; finishReason?: string }
    | { type: StreamEventType.ERROR; message: string }
);

export enum MessageType {
    USER = "user",
    ASSISTANT = "assistant"
}

export interface LogFunction { 
    (message: any, type: MessageType): Promise<void>;  
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