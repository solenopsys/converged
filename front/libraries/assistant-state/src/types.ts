import {
    ServiceType, StreamEventType, type StreamEvent,
    type AssistantService,
    ContentType,type ConversationOptions,type Tool,
   type ToolCall
} from 'integration/types/chats';

import { type ThreadsService, MessageType } from 'integration/types/threads';

export type ULID = string;

export type ChatMessage = {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: number;
    fileData?: {
        fileId: string;
        fileName: string;
        fileSize?: number;
        fileType?: string;
    };
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
    type AssistantService,
    ContentType,
    MessageType,
    type ConversationOptions,
    type Tool,
    type ToolCall
}
