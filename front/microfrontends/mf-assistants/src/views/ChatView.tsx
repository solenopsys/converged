import React, { useEffect } from 'react';
import { ChatDetail } from '../components/ChatDetail';
import { useUnit } from 'effector-react';
import { ChatState } from 'assistant-state';
import { chatStore, initializeChat } from "../chat-store";

const ChatView: React.FC = () => {
  const { messages, isLoading, currentResponse }: ChatState = useUnit(chatStore.$chat);

  useEffect(() => {
    console.log("[ChatView] Mounted - initializing chat immediately");
    // Инициализируем чат сразу при монтировании компонента
    initializeChat();
    console.log("[ChatView] State:", { messages: messages.length, isLoading, hasResponse: !!currentResponse });
    return () => {
      console.log("[ChatView] Unmounted");
    };
  }, []);

  useEffect(() => {
    console.log("[ChatView] State updated:", { messages: messages.length, isLoading, hasResponse: !!currentResponse });
  }, [messages, isLoading, currentResponse]);

  console.log("[ChatView] Rendering with", messages.length, "messages");

  return (
    <ChatDetail
      messages={messages}
      isLoading={isLoading}
      currentResponse={currentResponse}
      send={chatStore.send}
      showComposer={false}
    />
  );
};

export { ChatView };
