import React, { useEffect } from 'react';
import { ChatDetail } from '../components/ChatDetail';
import { useUnit } from 'effector-react';
import { ChatState } from 'assistant-state';
import { $fileListItems } from 'files-state';
import { chatStore, initializeChat } from "../chat-store";

type ChatViewProps = {
  contextName?: string;
};

const ChatView: React.FC<ChatViewProps> = ({ contextName }) => {
  const { messages, isLoading, currentResponse }: ChatState = useUnit(chatStore.$chat);
  const fileItems = useUnit($fileListItems);

  useEffect(() => {
    console.log("[ChatView] Mounted - initializing chat immediately");
    // Инициализируем чат сразу при монтировании компонента
    initializeChat(contextName);
    console.log("[ChatView] State:", { messages: messages.length, isLoading, hasResponse: !!currentResponse });
    return () => {
      console.log("[ChatView] Unmounted");
    };
  }, [contextName]);

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
      files={fileItems}
      showComposer={false}
    />
  );
};

export { ChatView };
