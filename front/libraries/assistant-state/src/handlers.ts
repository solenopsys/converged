import { type Store } from 'effector';
import * as types from './types';
import { receiveChunk, completeResponse, errorOccurred, sessionIdUpdated, toolCallReceived, toolCallExecuted } from './events';

// Улучшенная функция для обработки переносов строк
const preserveLineBreaks = (text: string): string => {
    if (!text) return '';

    // Обрабатываем различные варианты переносов строк
    return text
        .replace(/\\r\\n/g, '\r\n')  // Windows переносы
        .replace(/\\n/g, '\n')       // Unix переносы
        .replace(/\\r/g, '\r')       // Mac переносы
        .replace(/\\\\/g, '\\');     // Экранированные слеши
};

// Функция для накопления и обработки текста с переносами
const processAccumulatedText = (text: string): string => {
    // Применяем preserveLineBreaks только к накопленному тексту
    return preserveLineBreaks(text);
};

// Дополнительная функция для отладки - логирование с сохранением форматирования
export const debugLogContent = (content: string, label: string = 'Content') => {
    console.log(`${label}:`, {
        raw: content,
        length: content.length,
        hasLineBreaks: content.includes('\n'),
        lineBreaksCount: (content.match(/\n/g) || []).length,
        hasEscapedLineBreaks: content.includes('\\n'),
        escapedLineBreaksCount: (content.match(/\\n/g) || []).length
    });
};

const SESSION_NOT_FOUND_PATTERNS = [
    'SESSION_NOT_FOUND',
    'Conversation not found for sessionId',
    'Session not found:'
];

const isSessionNotFoundError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return SESSION_NOT_FOUND_PATTERNS.some((pattern) => message.includes(pattern));
};

const createAndSyncSession = async (
    aiService: types.AssistantService,
    state: types.ChatState
): Promise<string> => {
    const sessionId = await aiService.createSession(state.serviceType, state.model);
    sessionIdUpdated(sessionId);
    return sessionId;
};

const resolveSessionId = async (
    aiService: types.AssistantService,
    state: types.ChatState
): Promise<string> => {
    if (state.sessionId) {
        return state.sessionId;
    }

    return createAndSyncSession(aiService, state);
};

const consumeStreamEvents = async (
    events: AsyncIterable<types.StreamEvent>
): Promise<void> => {
    for await (const event of events) {
        receiveChunk(event);

        if (event.type === types.StreamEventType.COMPLETED) {
            completeResponse();
            break;
        }

        if (event.type === types.StreamEventType.ERROR) {
            errorOccurred(event.message);
            break;
        }
    }
};

const sendWithSessionRecovery = async (
    aiService: types.AssistantService,
    state: types.ChatState,
    messages: any[],
    options: types.ConversationOptions
) => {
    let sessionId = await resolveSessionId(aiService, state);

    try {
        await consumeStreamEvents(aiService.sendMessage(sessionId, messages, options));
        return;
    } catch (error) {
        if (!isSessionNotFoundError(error)) {
            throw error;
        }
    }

    // Session may be lost after microservice restart, recreate and retry once.
    sessionId = await createAndSyncSession(aiService, state);
    await consumeStreamEvents(aiService.sendMessage(sessionId, messages, options));
};

export const initializeChat = (
    _: types.ChatState,
    { threadId, serviceType, model }: { threadId: string; serviceType: any; model: string }
): types.ChatState => ({
    threadId,
    serviceType,
    model,
    sessionId: undefined,
    messages: [],
    isLoading: false,
    currentResponse: '',
    pendingToolCalls: []
});

export const addUserMessage = (
    state: types.ChatState,
    content: string
): types.ChatState => {
    const message: types.ChatMessage = {
        id: `msg_${Date.now()}`,
        type: 'user',
        content: preserveLineBreaks(content),
        timestamp: Date.now()
    };

    return {
        ...state,
        messages: [...state.messages, message],
        isLoading: true,
        currentResponse: '',
        pendingToolCalls: []
    };
};

export const updateResponse = (
    state: types.ChatState,
    event: any
): types.ChatState => {
    if (event.type === types.StreamEventType.TEXT_DELTA) {
        // ИСПРАВЛЕНИЕ: Не применяем preserveLineBreaks к отдельным чанкам
        // Просто накапливаем сырой контент, переносы обработаем при финализации
        const newContent = event.content || '';

        // Отладочная информация
        if (newContent.includes('\\n') || newContent.includes('\n')) {
            console.log('Найден перенос в чанке:', {
                content: newContent,
                hasEscaped: newContent.includes('\\n'),
                hasReal: newContent.includes('\n')
            });
        }

        return {
            ...state,
            currentResponse: state.currentResponse + newContent
        };
    }

    return state;
};

export const finalize = (state: types.ChatState): types.ChatState => {
    if (!state.currentResponse.trim() && state.pendingToolCalls.length === 0) {
        return {
            ...state,
            isLoading: false
        };
    }

    // ИСПРАВЛЕНИЕ: Применяем обработку переносов к накопленному тексту
    const processedContent = processAccumulatedText(state.currentResponse);

    // Отладочная информация
    debugLogContent(state.currentResponse, 'Raw accumulated content');
    debugLogContent(processedContent, 'Processed content');

    const assistantMessage: types.ChatMessage = {
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: processedContent,
        timestamp: Date.now()
    };

    return {
        ...state,
        messages: [...state.messages, assistantMessage],
        isLoading: false,
        currentResponse: '',
    };
};

export const handleError = (state: types.ChatState): types.ChatState => ({
    ...state,
    isLoading: false,
    currentResponse: '',
    pendingToolCalls: []
});

export const createSession = (aiService: types.AssistantService) =>
    async ({ serviceType, model }: types.ChatState) => {
        return await aiService.createSession(serviceType, model);
    };

export const saveAssistantMessage = (threadsService: types.ThreadsService) =>
    async (state: types.ChatState) => {
        if (!state.currentResponse.trim()) {
            return;
        }

        const processedContent = processAccumulatedText(state.currentResponse);

        await threadsService.saveMessage({
            threadId: state.threadId,
            user: 'assistant',
            type: types.MessageType.message,
            data: processedContent,
            timestamp: Date.now()
        });
    };

export const sendMessage = (
    aiService: types.AssistantService,
    threadsService: types.ThreadsService,
    $functions: Store<Record<string, types.ExecutableTool>>
) =>
    async ({ content, state }: { content: string; state: types.ChatState }) => {
        await threadsService.saveMessage({
            threadId: state.threadId,
            user: 'user',
            type: types.MessageType.message,
            data: preserveLineBreaks(content),
            timestamp: Date.now()
        });

        const messages = [{ type: types.ContentType.TEXT, data: preserveLineBreaks(content) }];
        const tools: types.Tool[] = Object.values($functions.getState()).map(({ execute, ...tool }) => tool);
        const options: types.ConversationOptions = { tools };

        try {
            await sendWithSessionRecovery(aiService, state, messages, options);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            errorOccurred(message);
        }
    };

export const executeToolCall = ($functions: Store<Record<string, types.ExecutableTool>>) =>
    async (toolCall: types.ToolCall) => {
        console.log('Executing tool call:', toolCall);
        const functions = $functions.getState();
        const func = functions[toolCall.name];
        if (func) {
            try {
                const result = await func.execute(toolCall.args);
                console.log('Tool call result:', result);
                return { toolCallId: toolCall.id, result };
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error('Tool call execution error:', message);
                throw new Error(message);
            }
        } else {
            const errorMessage = `Function "${toolCall.name}" not found`;
            console.error(errorMessage);
            throw new Error(errorMessage);
        }
    };

export const sendToolResult = (aiService: types.AssistantService, threadsService: types.ThreadsService) =>
    async ({ toolCallId, result, state }: { toolCallId: string, result: any, state: types.ChatState }) => {
        console.log('Sending tool result:', { toolCallId, result });

        // Улучшенная обработка результата инструмента с сохранением форматирования
        let toolResultContent: string;
        if (typeof result === 'string') {
            toolResultContent = preserveLineBreaks(result);
        } else {
            // Используем JSON.stringify с отступами для читаемости
            toolResultContent = JSON.stringify(result, null, 2);
        }

        await threadsService.saveMessage({
            threadId: state.threadId,
            user: 'assistant',
            type: types.MessageType.message,
            data: `Tool call ${toolCallId} result:\n${toolResultContent}`,
            timestamp: Date.now()
        });

        const messages = [{
            type: types.ContentType.TOOL_RESULT,
            tool_call_id: toolCallId,
            data: toolResultContent
        }];

        try {
            await sendWithSessionRecovery(aiService, state, messages, {});
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            errorOccurred(message);
        }
    };
