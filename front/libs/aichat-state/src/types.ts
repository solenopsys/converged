import {
    ServiceType, StreamEventType, StreamEvent,
    AiChatService,
    ContentType,ConversationOptions,Tool,
    ToolCall
} from '../../../../types/chats';

import { ThreadsService, MessageType } from '../../../../types/threads';

export type ULID = string;

export type ChatMessage = {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export type ChatState = {
    threadId: ULID;
    serviceType: ServiceType;
    model: string;
    sessionId?: string;
    messages: ChatMessage[];
    isLoading: boolean;
    currentResponse: string;
    pendingToolCalls: ToolCall[]; // Новое поле для хранения tool calls
}

// Расширенный тип Tool с функцией execute
export type ExecutableTool = Tool & {
    execute: (args: any) => Promise<any> | any;
}

export { 
    ServiceType, 
    StreamEventType,
    type StreamEvent, 
    type ThreadsService, 
    type AiChatService, 
    ContentType, 
    MessageType, 
    type ConversationOptions, 
    type Tool,
    type ToolCall
}