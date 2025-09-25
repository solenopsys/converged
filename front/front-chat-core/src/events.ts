import { createEvent } from 'effector'; 
import { ServiceType, StreamEvent,ULID } from './types';

export const initChat = createEvent<{
    threadId: ULID;
    serviceType: ServiceType;
    model: string;
}>();

export const sendMessage = createEvent<string>();
export const receiveChunk = createEvent<StreamEvent>();
export const completeResponse = createEvent<void>();
export const errorOccurred = createEvent<string>();
export const registerFunction = createEvent<{ name: string; handler: Function }>();
