import React, { useEffect, useMemo, useState } from 'react';
import { HeaderPanel, ThreadView } from "front-core";
import { threadsClient } from "../services";

interface ChatDetailViewProps {
  chatId?: string;
}

const ChatDetailView: React.FC<ChatDetailViewProps> = ({ chatId }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = async (threadId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await threadsClient.readThreadAllVersions(threadId);
      const rows = Array.isArray(response) ? response : [];
      const normalized = rows.map((msg: any, index: number) => ({
        id: msg.id || `msg-${index}`,
        beforeId: msg.beforeId,
        user: msg.user,
        data: msg.data || msg.content || "",
        timestamp: msg.timestamp || Date.now(),
      }));
      setMessages(normalized);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load chat history");
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }
    void loadMessages(chatId);
  }, [chatId]);

  const headerConfig = useMemo(() => ({
    title: chatId ? `Chat ${chatId.slice(0, 8)}...` : "Chat",
    actions: [],
  }), [chatId]);

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Выберите чат из списка</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HeaderPanel config={headerConfig} />
      {error ? (
        <div className="px-4 py-2 text-sm text-destructive border-b border-border">
          {error}
        </div>
      ) : null}
      <div className="px-4 py-2 text-sm text-muted-foreground border-b border-border">
        {messages.length} {messages.length === 1 ? "message" : "messages"}
      </div>
      <div className="flex-1 min-h-0">
        <ThreadView
          messages={messages}
          isLoading={isLoading}
          currentUserId="user"
          emptyText="Thread is empty."
          loadingText="Loading chat..."
        />
      </div>
    </div>
  );
};

export { ChatDetailView };
