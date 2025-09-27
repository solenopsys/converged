import { createEffect, sample } from 'effector';
import {
    ThreadsService,
    AiChatService,
    ULID,
    ExecutableTool,
    ToolCall,
    StreamEventType
} from './types';
import { ChatState } from './types';
import * as handlers from './handlers';
import {
    initChat,
    sendMessage,
    receiveChunk,
    completeResponse,
    errorOccurred,
    registerFunction,
    toolCallReceived,
    toolCallExecuted
} from './events';
import { chatDomain } from './domain';

const initialState: ChatState = {
    threadId: '' as ULID,
    serviceType: '' as any,
    model: '',
    messages: [],
    isLoading: false,
    currentResponse: '',
    pendingToolCalls: []
};

export const createChatStore = (
    aiService: AiChatService,
    threadsService: ThreadsService
) => {
    const $chat = chatDomain.createStore<ChatState>(initialState, { name: 'CHAT' })
        .on(initChat, handlers.initializeChat)
        .on(sendMessage, handlers.addUserMessage)
        .on(receiveChunk, handlers.updateResponse)
        .on(completeResponse, handlers.finalize)
        .on(errorOccurred, handlers.handleError)
        .on(toolCallReceived, (state, toolCall) => ({
            ...state,
            pendingToolCalls: [...state.pendingToolCalls, toolCall]
        }))
        .on(toolCallExecuted, (state, { toolCallId }) => ({
            ...state,
            pendingToolCalls: state.pendingToolCalls.filter(tc => tc.id !== toolCallId)
        }));

    const $functions = chatDomain.createStore<Record<string, ExecutableTool>>({}, { name: 'FUNCTIONS' })
        .on(registerFunction, (registry, { name, handler }) => ({
            ...registry,
            [name]: handler
        }));

    const createSessionFx = chatDomain.createEffect<ChatState, string>('CREATE_SESSION_FX');
    const sendMessageFx = chatDomain.createEffect<{ content: string; state: ChatState }, void>('SEND_MESSAGE_FX');
    const executeToolCallFx = chatDomain.createEffect<ToolCall, { toolCallId: string, result: any }, Error>('EXECUTE_TOOL_CALL_FX');
    const sendToolResultFx = chatDomain.createEffect<{ toolCallId: string, result: any, state: ChatState }, void>('SEND_TOOL_RESULT_FX');

    createSessionFx.use(handlers.createSession(aiService));
    sendMessageFx.use(handlers.sendMessage(aiService, threadsService, $functions));
    executeToolCallFx.use(handlers.executeToolCall($functions));
    sendToolResultFx.use(handlers.sendToolResult(aiService, threadsService));

    // Связки событий и эффектов
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
        fn: (state, content) => ({ content, state }),
        target: sendMessageFx
    });

    // Обработка tool calls - вызов toolCallReceived при получении TOOL_CALL события
    sample({
        clock: receiveChunk,
        filter: (event) => event.type === StreamEventType.TOOL_CALL,
        fn: (event) => event as ToolCall,
        target: toolCallReceived
    });

    // Выполнение tool call
    sample({
        clock: toolCallReceived,
        target: executeToolCallFx
    });

    // Отправка результата tool call
    sample({
        clock: executeToolCallFx.doneData,
        source: $chat,
        fn: (state, { toolCallId, result }) => ({ toolCallId, result, state }),
        target: sendToolResultFx
    });

    // Обновление состояния после выполнения tool call
    sample({
        clock: executeToolCallFx.doneData,
        fn: ({ toolCallId, result }) => ({ toolCallId, result }),
        target: toolCallExecuted
    });

    // Обработка ошибок tool call
    sample({
        clock: executeToolCallFx.failData,
        fn: (error) => {
            console.error('Tool call execution failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errorOccurred(errorMessage);
            return { toolCallId: '', result: null, error: errorMessage };
        },
        target: toolCallExecuted
    });

    return {
        $chat,
        $functions,

        init: (threadId: ULID, serviceType: any, model: string) =>
            initChat({ threadId, serviceType, model }),

        send: (content: string) => sendMessage(content),

        registerFunction: (name: string, handler: ExecutableTool) =>
            registerFunction({ name, handler }),

        get messages() { return $chat.getState().messages; },
        get isLoading() { return $chat.getState().isLoading; },
        get currentResponse() { return $chat.getState().currentResponse; }
    };
};