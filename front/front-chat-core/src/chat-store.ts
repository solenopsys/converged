import { createStore, createEffect, sample, createDomain } from 'effector';
import { 
    ThreadsService, 
    AiChatService, 
    ContentType, 
    MessageType,
    StreamEventType, 
    ULID
} from './types';
import { ChatState } from './types';
import * as handlers from './handlers';
import {
    initChat,
    sendMessage,
    receiveChunk,
    completeResponse,
    errorOccurred,
    registerFunction
} from './events';
import { chatDomain } from './domain';

// Create domain

const initialState: ChatState = {
    threadId: '' as ULID,
    serviceType: '' as any,
    model: '',
    messages: [],
    isLoading: false,
    currentResponse: ''
};

export const createChatStore = (
    aiService: AiChatService,
    threadsService: ThreadsService
) => {
    // Store
    const $chat = chatDomain.createStore<ChatState>(initialState, { name: 'CHAT' })
        .on(initChat, handlers.initializeChat)
        .on(sendMessage, handlers.addUserMessage)
        .on(receiveChunk, handlers.updateResponse)
        .on(completeResponse, handlers.finalize)
        .on(errorOccurred, handlers.handleError);

    const $functions = chatDomain.createStore<Record<string, Function>>({}, { name: 'FUNCTIONS' })
        .on(registerFunction, (registry, { name, handler }) => ({
            ...registry,
            [name]: handler
        }));

    // Effects with names
    const createSessionFx = chatDomain.createEffect<ChatState, string>('CREATE_SESSION_FX');
    const sendMessageFx = chatDomain.createEffect<{ content: string; state: ChatState }, void>('SEND_MESSAGE_FX');

    createSessionFx.use(async ({ serviceType, model }) => 
        await aiService.createSession(serviceType, model)
    );

    sendMessageFx.use(async ({ content, state }) => {
        if (!state.sessionId) return;

        // Save to threads
        await threadsService.saveMessage({
            threadId: state.threadId,
            user: 'user',
            type: MessageType.message,
            data: content,
            timestamp: Date.now()
        });

        // Stream from AI
        const messages = [{ type: ContentType.TEXT, data: content }];
        
        try {
            for await (const event of aiService.sendMessage(state.sessionId, messages)) {
                receiveChunk(event);

                if (event.type === StreamEventType.COMPLETED) {
                    // Save assistant response
                    const currentState = $chat.getState();
                    await threadsService.saveMessage({
                        threadId: state.threadId,
                        user: 'assistant', 
                        type: MessageType.message,
                        data: currentState.currentResponse,
                        timestamp: Date.now()
                    });
                    
                    completeResponse();
                    break;
                }

                if (event.type === StreamEventType.ERROR) {
                    errorOccurred(event.message);
                    break;
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            errorOccurred(message);
        }
    });

    // Connections
    sample({
        clock: initChat,
        target: createSessionFx
    });

    sample({
        clock: createSessionFx.doneData,
        source: $chat,
        fn: (state, sessionId) => ({ ...state, sessionId }),
        target: $chat
    });

    sample({
        clock: sendMessage,
        source: $chat,
    //    filter: (state) => !!state.sessionId && !state.isLoading,
        fn: (state, content) => ({ content, state }),
        target: sendMessageFx
    });

    // Public API
    return {
        $chat,
        $functions,
        
        init: (threadId: ULID, serviceType: any, model: string) =>
            initChat({ threadId, serviceType, model }),
            
        send: (content: string) => sendMessage(content),
        
        registerFunction: (name: string, handler: Function) =>
            registerFunction({ name, handler }),
            
        // Getters
        get messages() { return $chat.getState().messages; },
        get isLoading() { return $chat.getState().isLoading; },
        get currentResponse() { return $chat.getState().currentResponse; }
    };
};