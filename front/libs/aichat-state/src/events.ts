import { createDomain } from 'effector';
import { ServiceType, StreamEvent, ULID, ToolCall } from './types';
import { chatDomain } from './domain';
import { Tool } from './types';
 

export const initChat = chatDomain.createEvent<{
    threadId: ULID;
    serviceType: ServiceType;
    model: string;
}>('INIT_CHAT');

export const sendMessage = chatDomain.createEvent<string>('SEND_MESSAGE');
export const receiveChunk = chatDomain.createEvent<StreamEvent>('RECEIVE_CHUNK');
export const completeResponse = chatDomain.createEvent<void>('COMPLETE_RESPONSE');
export const errorOccurred = chatDomain.createEvent<string>('ERROR_OCCURRED');

export const registerFunction = chatDomain.createEvent<{ 
    name: string; 
    handler: Tool & { execute: (args: any) => Promise<any> | any }; 
}>('REGISTER_FUNCTION');

// Новые события для обработки tool calls
export const toolCallReceived = chatDomain.createEvent<ToolCall>('TOOL_CALL_RECEIVED');
export const toolCallExecuted = chatDomain.createEvent<{ 
    toolCallId: string; 
    result: any; 
    error?: string; 
}>('TOOL_CALL_EXECUTED');