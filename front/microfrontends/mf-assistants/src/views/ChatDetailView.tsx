import React, { useEffect, useState } from 'react';
import { ChatDetail } from '../components/ChatDetail';
import { threadsClient } from "../services";

interface ChatDetailViewProps {
  chatId?: string;
}

const ChatDetailView: React.FC<ChatDetailViewProps> = ({ chatId }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log("[ChatDetailView] Mounted with chatId:", chatId);
    return () => {
      console.log("[ChatDetailView] Unmounted");
    };
  }, []);

  useEffect(() => {
    if (chatId) {
      console.log("[ChatDetailView] Loading chat messages for:", chatId);

      const loadMessages = () => {
        setIsLoading(true);
        // Загружаем сообщения из выбранного чата
        threadsClient.readThread(chatId).then((thread) => {
          console.log("[ChatDetailView] Loaded thread:", thread);

          // Преобразуем сообщения в нужный формат
          const formattedMessages = (thread.messages || []).map((msg: any, index: number) => ({
            id: msg.id || `msg-${index}`,
            type: msg.user === 'user' ? 'user' : 'assistant',
            content: msg.data || msg.content || '',
            timestamp: msg.timestamp || Date.now(),
          }));

          setMessages(formattedMessages);
          setIsLoading(false);
        }).catch((error) => {
          console.error("[ChatDetailView] Error loading thread:", error);
          setIsLoading(false);
        });
      };

      loadMessages();
    }
  }, [chatId]);

  console.log("[ChatDetailView] Rendering, chatId:", chatId, "messages:", messages.length);

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Выберите чат из списка</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-muted/30">
        <h2 className="text-lg font-semibold">
          Chat: {chatId.slice(0, 8)}...
        </h2>
        <p className="text-sm text-muted-foreground">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </p>
      </div>
      <ChatDetail
        messages={messages}
        isLoading={isLoading}
        currentResponse=""
        send={() => {}}
        showComposer={false}
      />
    </div>
  );
};

export { ChatDetailView };
