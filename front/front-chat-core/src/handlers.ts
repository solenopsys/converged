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
        content,
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
        return {
            ...state,
            currentResponse: state.currentResponse + event.content
        };
    }

    // Убираем вызов toolCallReceived отсюда - он должен происходить в store
    return state;
};

export const finalize = (state: ChatState): ChatState => {
    if (!state.currentResponse.trim() && state.pendingToolCalls.length === 0) {
        return {
            ...state,
            isLoading: false
        };
    }

    const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        type: 'assistant',
        content: state.currentResponse,
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
            data: content,
            timestamp: Date.now()
        });

        const messages = [{ type: ContentType.TEXT, data: content }];
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

        const toolResultContent = JSON.stringify(result);

        await threadsService.saveMessage({
            threadId: state.threadId,
            user: 'assistant',
            type: MessageType.message,
            data: `Tool call ${toolCallId} result: ${toolResultContent}`,
            timestamp: Date.now()
        });

        const messages = [{ type: ContentType.TOOL_RESULT, tool_call_id: toolCallId, data: toolResultContent }];

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