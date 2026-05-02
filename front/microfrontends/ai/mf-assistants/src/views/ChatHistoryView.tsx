import React, { useEffect, useMemo, useState } from "react";
import type { ChatMessage } from "assistant-state";
import { MessageType, type Message as ThreadMessage } from "g-threads";

import { ChatDetail } from "../components/ChatDetail";
import { threadsClient } from "../services";

type ChatHistoryViewProps = {
  threadId: string;
};

type LinkData = {
  kind?: string;
  target?: string;
  label?: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  file?: {
    fileId?: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
  };
};

function parseLinkData(data: string): LinkData | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    return parsed && typeof parsed === "object" ? parsed as LinkData : null;
  } catch {
    return null;
  }
}

function toChatMessage(message: ThreadMessage, index: number): ChatMessage | null {
  const user = message.user === "assistant" ? "assistant" : "user";

  if (message.type === MessageType.link || message.type === "link") {
    const linkData = parseLinkData(message.data ?? "");
    const fileId = linkData?.fileId ?? linkData?.file?.fileId;
    const fileName = linkData?.fileName ?? linkData?.file?.fileName ?? linkData?.label;

    if (fileId && fileName) {
      return {
        id: message.id ?? `history-file-${index}-${message.timestamp ?? Date.now()}`,
        beforeId: message.beforeId,
        type: user,
        content: `Файл загружен: ${fileName}`,
        timestamp: message.timestamp ?? 0,
        fileData: {
          fileId,
          fileName,
          fileSize: linkData?.fileSize ?? linkData?.file?.fileSize,
          fileType: linkData?.fileType ?? linkData?.file?.fileType,
        },
      };
    }

    return {
      id: message.id ?? `history-link-${index}-${message.timestamp ?? Date.now()}`,
      beforeId: message.beforeId,
      type: user,
      content: linkData?.label ?? message.data ?? "",
      timestamp: message.timestamp ?? 0,
    };
  }

  if (message.type !== MessageType.message && message.type !== "message") return null;

  return {
    id: message.id ?? `history-${index}-${message.timestamp ?? Date.now()}`,
    beforeId: message.beforeId,
    type: user,
    content: message.data ?? "",
    timestamp: message.timestamp ?? 0,
  };
}

export const ChatHistoryView: React.FC<ChatHistoryViewProps> = ({ threadId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setIsLoading(true);
      setError(null);

      try {
        const rows = await threadsClient.readThread(threadId);
        if (cancelled) return;

        const nextMessages = rows
          .map(toChatMessage)
          .filter((message): message is ChatMessage => message !== null)
          .sort((left, right) => left.timestamp - right.timestamp);

        setMessages(nextMessages);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load chat history");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const intro = useMemo(
    () => error ? <div className="p-3 text-sm text-destructive">{error}</div> : null,
    [error],
  );

  return (
    <ChatDetail
      messages={messages}
      isLoading={isLoading}
      currentResponse=""
      send={() => {}}
      showComposer={false}
      intro={intro}
    />
  );
};
