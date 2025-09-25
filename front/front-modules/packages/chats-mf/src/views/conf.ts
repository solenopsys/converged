export type ChatMessage = {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
};

export type ChatState = {
  messages: ChatMessage[];
  isLoading: boolean;
  currentResponse: string;
};

// Mock chat store for demo (simple object, не effector store)
export const mockChatStore: {
  $chat: ChatState;
  send: (content: string) => void;
} = {
  $chat: {
    messages: [
      { id: '1', type: 'user', content: 'Привет! Как дела?', timestamp: Date.now() - 60000 },
      { id: '2', type: 'assistant', content: 'Привет! Всё отлично, готов помочь с любыми вопросами.', timestamp: Date.now() - 30000 }
    ],
    isLoading: false,
    currentResponse: ''
  },
  send: (content: string) => {
    console.log('Sending message:', content);
    // Для демо просто пушим в массив (в реальном приложении — через store/action)
    mockChatStore.$chat.messages.push({
      id: String(Date.now()),
      type: 'user',
      content,
      timestamp: Date.now()
    });
  }
};