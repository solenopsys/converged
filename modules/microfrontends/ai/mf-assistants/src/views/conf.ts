import { ChatState } from '../components/ChatDetail';

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
    mockChatStore.$chat.messages.push({
      id: String(Date.now()),
      type: 'user',
      content,
      timestamp: Date.now()
    });
  }
};