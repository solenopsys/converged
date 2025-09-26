import { createDomain } from 'effector';
import { ServiceType, StreamEvent, ULID } from './types';
import { chatDomain } from './domain';
 

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
    handler: Function; 
}>('REGISTER_FUNCTION');