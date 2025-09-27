import { Store } from 'effector';
import {
    ChatState,
    ChatMessage,
    StreamEventType,
    AiChatService,
    ThreadsService,
    ContentType,
    MessageType,
    Tool,
    ConversationOptions,
    ExecutableTool,
    ToolCall
} from './types';
import { receiveChunk, completeResponse, errorOccurred, toolCallReceived, toolCallExecuted } from './events';

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

export const initializeChat = (
    _: ChatState,
    { threadId, serviceType, model }: { threadId: string; serviceType: any; model: string }
): ChatState => ({
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
    state: ChatState,
    content: string
): ChatState => {
    const message: ChatMessage = {
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
    state: ChatState,
    event: any
): ChatState => {
    if (event.type === StreamEventType.TEXT_DELTA) {
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

export const finalize = (state: ChatState): ChatState => {
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

    const assistantMessage: ChatMessage = {
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

export const handleError = (state: ChatState): ChatState => ({
    ...state,
    isLoading: false,
    currentResponse: '',
    pendingToolCalls: []
});

export const createSession = (aiService: AiChatService) =>
    async ({ serviceType, model }: ChatState) => {
        return await aiService.createSession(serviceType, model);
    };

export const sendMessage = (
    aiService: AiChatService,
    threadsService: ThreadsService,
    $functions: Store<Record<string, ExecutableTool>>
) =>
    async ({ content, state }: { content: string; state: ChatState }) => {
        if (!state.sessionId) return;

        await threadsService.saveMessage({
            threadId: state.threadId,
            user: 'user',
            type: MessageType.message,
            data: preserveLineBreaks(content),
            timestamp: Date.now()
        });

        const messages = [{ type: ContentType.TEXT, data: preserveLineBreaks(content) }];
        const tools: Tool[] = Object.values($functions.getState()).map(({ execute, ...tool }) => tool);
        const options: ConversationOptions = { tools };

        try {
            for await (const event of aiService.sendMessage(state.sessionId, messages, options)) {
                receiveChunk(event);

                if (event.type === StreamEventType.COMPLETED) {
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
    };

export const executeToolCall = ($functions: Store<Record<string, ExecutableTool>>) =>
    async (toolCall: ToolCall) => {
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

export const sendToolResult = (aiService: AiChatService, threadsService: ThreadsService) =>
    async ({ toolCallId, result, state }: { toolCallId: string, result: any, state: ChatState }) => {
        console.log('Sending tool result:', { toolCallId, result });
        
        if (!state.sessionId) {
            console.error('No session ID available for tool result');
            return;
        }

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
            type: MessageType.message,
            data: `Tool call ${toolCallId} result:\n${toolResultContent}`,
            timestamp: Date.now()
        });

        const messages = [{ 
            type: ContentType.TOOL_RESULT, 
            tool_call_id: toolCallId, 
            data: toolResultContent 
        }];

        try {
            for await (const event of aiService.sendMessage(state.sessionId, messages, {})) {
                receiveChunk(event);

                if (event.type === StreamEventType.COMPLETED) {
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
    };