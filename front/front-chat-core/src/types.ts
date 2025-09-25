 import { ServiceType, StreamEventType,StreamEvent, 
    AiChatService, 
    ContentType, 
   } from '../../../types/chats';


    import { ThreadsService, MessageType } from '../../../types/threads';

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
}

export {ServiceType, StreamEventType,StreamEvent,ThreadsService,AiChatService,ContentType,MessageType}