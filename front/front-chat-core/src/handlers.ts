import { ChatState, ChatMessage,StreamEventType } from './types';
 
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
    currentResponse: ''
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
        currentResponse: ''
    };
};

export const updateResponse = (
    state: ChatState,
    event: any
): ChatState => {
    if (event.type !== StreamEventType.TEXT_DELTA) return state;
    
    return {
        ...state,
        currentResponse: state.currentResponse + event.content
    };
};

export const finalize = (state: ChatState): ChatState => {
    if (!state.currentResponse) return { ...state, isLoading: false };

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
        currentResponse: ''
    };
};

export const handleError = (state: ChatState): ChatState => ({
    ...state,
    isLoading: false,
    currentResponse: ''
});

export const setSessionId = (state: ChatState, sessionId: string): ChatState => ({
    ...state,
    sessionId
});
