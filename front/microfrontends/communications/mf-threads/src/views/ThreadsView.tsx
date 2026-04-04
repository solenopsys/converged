import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HeaderPanel, ThreadView, Card, CardHeader, CardTitle, CardContent, Button } from "front-core";
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
  threadIds?: string[];
  title?: string;
  userId?: string;
};

type ResolvedThreadsEnv = {
  threadId: string;
  threadIds: string[];
  title: string;
  userId: string;
};

type ThreadSummary = {
  threadId: string;
  messageCount: number;
  usersCount: number;
  lastTimestamp: number;
  preview: string;
};

function readThreadsEnv(): ResolvedThreadsEnv {
  const globalEnv = (globalThis as any).__MF_ENV__ as Record<string, unknown> | undefined;
  const raw = (globalEnv?.["mf-threads"] ?? {}) as ThreadsEnv;
  const fallbackThreadId = raw.threadId ?? "public-chat";
  const threadIdsFromEnv = Array.isArray(raw.threadIds)
    ? raw.threadIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const threadIds = [...new Set([fallbackThreadId, ...threadIdsFromEnv])];

  return {
    threadId: fallbackThreadId,
    threadIds,
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
  const [messagesByThread, setMessagesByThread] = useState<Record<string, ThreadMessageView[]>>({});
  const [summaries, setSummaries] = useState<ThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState(env.threadId);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadThreads = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const result = await Promise.all(
        env.threadIds.map(async (threadId) => {
          const response = await threadsClient.readThreadAllVersions(threadId);
          const rows = Array.isArray(response) ? (response as ThreadMessage[]) : [];
          return {
            threadId,
            messages: normalizeMessages(rows),
          };
        }),
      );

      const nextByThread: Record<string, ThreadMessageView[]> = {};
      const nextSummaries: ThreadSummary[] = [];

      for (const item of result) {
        nextByThread[item.threadId] = item.messages;
        const sorted = [...item.messages].sort(
          (left, right) => (right.timestamp ?? 0) - (left.timestamp ?? 0),
        );
        const last = sorted[0];
        const usersCount = new Set(item.messages.map((message) => message.user || "unknown")).size;
        nextSummaries.push({
          threadId: item.threadId,
          messageCount: item.messages.length,
          usersCount,
          lastTimestamp: last?.timestamp ?? 0,
          preview: last?.data?.slice(0, 80) ?? "",
        });
      }

      nextSummaries.sort((left, right) => right.lastTimestamp - left.lastTimestamp);
      setMessagesByThread(nextByThread);
      setSummaries(nextSummaries);
      setSelectedThreadId((current) =>
        nextByThread[current]?.length !== undefined
          ? current
          : (nextSummaries[0]?.threadId ?? env.threadId),
      );
    } catch (loadError) {
      if (!options?.silent) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load threads");
      }
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [env.threadId, env.threadIds]);

  useEffect(() => {
    void loadThreads();
    const timer = setInterval(() => {
      void loadThreads({ silent: true });
    }, 8000);

    return () => {
      clearInterval(timer);
    };
  }, [loadThreads]);

  const headerConfig = useMemo(
    () => ({
      title: env.title,
      actions: [],
    }),
    [env.title],
  );

  const selectedMessages = messagesByThread[selectedThreadId] ?? [];
  const totalMessages = useMemo(
    () => summaries.reduce((acc, summary) => acc + summary.messageCount, 0),
    [summaries],
  );
  const totalUsers = useMemo(() => {
    const users = new Set<string>();
    for (const messages of Object.values(messagesByThread)) {
      for (const message of messages) {
        if (message.user) users.add(message.user);
      }
    }
    return users.size;
  }, [messagesByThread]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HeaderPanel config={headerConfig} />
      {error ? (
        <div className="px-4 py-2 text-sm text-destructive border-b border-border">
          {error}
        </div>
      ) : null}
      <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Threads total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{summaries.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Messages total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{totalMessages}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{totalUsers}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Card className="min-h-[420px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Thread list</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {summaries.length === 0 && !isLoading ? (
                <div className="text-sm text-muted-foreground">No threads found.</div>
              ) : null}
              {summaries.map((summary) => (
                <Button
                  key={summary.threadId}
                  variant={summary.threadId === selectedThreadId ? "default" : "outline"}
                  className="w-full h-auto justify-start px-3 py-2"
                  onClick={() => setSelectedThreadId(summary.threadId)}
                >
                  <div className="text-left">
                    <div className="font-medium">{summary.threadId}</div>
                    <div className="text-xs opacity-80">
                      {summary.messageCount} msgs · {summary.usersCount} users
                    </div>
                    {summary.preview ? (
                      <div className="text-xs opacity-70 truncate max-w-[260px]">{summary.preview}</div>
                    ) : null}
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="min-h-[420px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Thread details</CardTitle>
            </CardHeader>
            <CardContent className="h-[520px] min-h-0">
              <ThreadView
                messages={selectedMessages}
                isLoading={isLoading}
                currentUserId={env.userId || undefined}
                emptyText="Thread is empty."
                loadingText="Loading threads..."
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
