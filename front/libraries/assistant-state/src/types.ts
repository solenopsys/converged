import {
    ServiceType, StreamEventType, type StreamEvent,
    type RuntimeAssistantService,
    ContentType,type ConversationOptions,type Tool,
   type ToolCall
} from '../../../../tools/integration/types/runtime/ai/assistant';

import { type ThreadsService, MessageType } from '../../../../tools/integration/types/services/communications/threads';

export type ULID = string;

export type ChatMessage = {
    id: string;
    beforeId?: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: number;
    toolCallData?: {
        toolCallId?: string;
        title: string;
        summary?: string;
        details?: Record<string, any> | Array<unknown> | string;
    };
    fileData?: {
        fileId: string;
        fileName: string;
        fileSize?: number;
        fileType?: string;
    };
}

export type ChatState = {
    threadId: ULID;
    serviceType?: ServiceType;
    model?: string;
    contextName?: string;
    language?: string;
    sessionId?: string;
    messages: ChatMessage[];
    isLoading: boolean;
    currentResponse: string;
    pendingToolCalls: ToolCall[];
    lastToolCallName?: string;
}

export type ChatMetadataService = {
    recordChatMessage(threadId: string): Promise<any>;
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
    type RuntimeAssistantService,
    ContentType,
    MessageType,
    type ConversationOptions,
    type Tool,
    type ToolCall
}
