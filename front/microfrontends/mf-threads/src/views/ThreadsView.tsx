import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HeaderPanel, ThreadView } from "front-core";
import { threadsClient, type Message as ThreadMessage } from "g-threads";

type ThreadMessageView = {
  id: string;
  beforeId?: string;
  user?: string;
  data?: string;
  timestamp?: number;
};

type ThreadsEnv = {
  threadId?: string;
  title?: string;
  userId?: string;
};

function readThreadsEnv(): Required<ThreadsEnv> {
  const globalEnv = (globalThis as any).__MF_ENV__ as Record<string, unknown> | undefined;
  const raw = (globalEnv?.["mf-threads"] ?? {}) as ThreadsEnv;

  return {
    threadId: raw.threadId ?? "public-chat",
    title: raw.title ?? "Threads",
    userId: raw.userId ?? "",
  };
}

function normalizeMessages(input: ThreadMessage[]): ThreadMessageView[] {
  return input.map((message, index) => ({
    id: message.id ?? `msg-${index}-${message.timestamp ?? Date.now()}`,
    beforeId: message.beforeId,
    user: message.user,
    data: message.data,
    timestamp: message.timestamp,
  }));
}

export const ThreadsView = () => {
  const env = useMemo(() => readThreadsEnv(), []);
  const [messages, setMessages] = useState<ThreadMessageView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThread = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response = await threadsClient.readThreadAllVersions(env.threadId);
      const rows = Array.isArray(response) ? (response as ThreadMessage[]) : [];
      setMessages(normalizeMessages(rows));
    } catch (loadError) {
      if (!options?.silent) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load thread");
      }
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [env.threadId]);

  useEffect(() => {
    void loadThread();
    const timer = setInterval(() => {
      void loadThread({ silent: true });
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [loadThread]);

  const headerConfig = useMemo(
    () => ({
      title: env.title,
      actions: [],
    }),
    [env.title],
  );

  return (
    <div className="flex flex-col h-full">
      <HeaderPanel config={headerConfig} />
      {error ? (
        <div className="px-4 py-2 text-sm text-destructive border-b border-border">
          {error}
        </div>
      ) : null}
      <div className="flex-1 min-h-0">
        <ThreadView
          messages={messages}
          isLoading={isLoading}
          currentUserId={env.userId || undefined}
          emptyText="Thread is empty."
          loadingText="Loading thread..."
        />
      </div>
    </div>
  );
};
