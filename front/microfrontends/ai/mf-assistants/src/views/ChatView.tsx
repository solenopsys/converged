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
  const { messages, isLoading, currentResponse, lastToolCallName }: ChatState = useUnit(chatStore.$chat);
  const fileItems = useUnit($fileListItems);

  useEffect(() => {
    initializeChat(contextName);
  }, [contextName]);

  return (
    <ChatDetail
      messages={messages}
      isLoading={isLoading}
      currentResponse={currentResponse}
      lastToolCallName={lastToolCallName}
      send={chatStore.send}
      files={fileItems}
      showComposer={false}
    />
  );
};

export { ChatView };
