import React, { useCallback, useEffect, useMemo, useState } from "react";
import { HeaderPanel, ThreadedChat, cn } from "front-core";
import type { ChartRoom } from "g-charts";
import { MessageType } from "integration/types/threads";
import { chartsClient, threadsClient } from "../services";
import styles from "./ChatView.module.css";

type RawThreadMessage = {
  id?: string;
  beforeId?: string;
  user?: string;
  data?: string;
  timestamp?: number;
};

type ChatThreadMessage = {
  id: string;
  beforeId?: string;
  user: string;
  content: string;
  timestamp: number;
};

type ChartsEnv = {
  userId?: string;
  title?: string;
  placeholder?: string;
  roomId?: string;
};

function readChartsEnv(): Required<ChartsEnv> {
  const globalEnv = (globalThis as any).__MF_ENV__ as Record<string, unknown> | undefined;
  const raw = (globalEnv?.["mf-charts"] ?? {}) as ChartsEnv;

  return {
    userId: raw.userId ?? "guest",
    title: raw.title ?? "Chats",
    placeholder: raw.placeholder ?? "Напишите сообщение...",
    roomId: raw.roomId ?? "",
  };
}

function mapThreadMessages(input: RawThreadMessage[]): ChatThreadMessage[] {
  return input
    .map((message, index) => ({
      id: message.id ?? `msg-${index}-${message.timestamp ?? Date.now()}`,
      beforeId: message.beforeId,
      user: message.user ?? "unknown",
      content: message.data ?? "",
      timestamp: message.timestamp ?? 0,
    }))
    .filter((message) => message.content.length > 0);
}

const ChatView: React.FC = () => {
  const env = useMemo(() => readChartsEnv(), []);
  const [rooms, setRooms] = useState<ChartRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(env.roomId);
  const [messages, setMessages] = useState<ChatThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const loadRooms = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const response = await chartsClient.listRooms({
          offset: 0,
          limit: 100,
          userId: env.userId || undefined,
          archived: false,
        });
        const items = Array.isArray(response?.items) ? (response.items as ChartRoom[]) : [];
        setRooms(items);

        if (!selectedRoomId || !items.some((room) => room.id === selectedRoomId)) {
          const preferred = env.roomId ? items.find((room) => room.id === env.roomId) : undefined;
          setSelectedRoomId(preferred?.id ?? items[0]?.id ?? "");
        }
      } catch (loadError) {
        if (!options?.silent) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load rooms");
        }
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [env.roomId, env.userId, selectedRoomId],
  );

  const loadThread = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!selectedRoom) {
        setMessages([]);
        if (!options?.silent) {
          setIsLoading(false);
        }
        return;
      }

      if (!options?.silent) {
        setIsLoading(true);
      }

      try {
        const response = await threadsClient.readThreadAllVersions(selectedRoom.threadId);
        const rows = Array.isArray(response) ? (response as RawThreadMessage[]) : [];
        setMessages(mapThreadMessages(rows));
      } catch (loadError) {
        if (!options?.silent) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load thread");
        }
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [selectedRoom],
  );

  useEffect(() => {
    void loadRooms();
    const timer = setInterval(() => {
      void loadRooms({ silent: true });
    }, 8000);

    return () => {
      clearInterval(timer);
    };
  }, [loadRooms]);

  useEffect(() => {
    void loadThread();
    const timer = setInterval(() => {
      void loadThread({ silent: true });
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [loadThread]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!selectedRoom) return;

      const text = content.trim();
      if (!text || isSending) return;

      setIsSending(true);
      setError(null);
      try {
        const parent = [...messages].sort((left, right) => right.timestamp - left.timestamp)[0];
        await threadsClient.saveMessage({
          threadId: selectedRoom.threadId,
          beforeId: parent?.id,
          user: env.userId,
          type: MessageType.message,
          data: text,
        });
        await loadThread({ silent: true });
      } catch (sendError) {
        setError(sendError instanceof Error ? sendError.message : "Failed to send message");
      } finally {
        setIsSending(false);
      }
    },
    [env.userId, isSending, loadThread, messages, selectedRoom],
  );

  const headerConfig = useMemo(
    () => ({
      title: selectedRoom?.title || env.title,
      actions: [],
    }),
    [env.title, selectedRoom?.title],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HeaderPanel config={headerConfig} />

      <div className={styles.roomsBar}>
        <label className={styles.roomsLabel} htmlFor="charts-room-select">
          Room
        </label>
        <select
          id="charts-room-select"
          className={styles.roomsSelect}
          value={selectedRoomId}
          onChange={(event) => setSelectedRoomId(event.target.value)}
        >
          {rooms.length === 0 ? <option value="">No rooms</option> : null}
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.title || room.id}
            </option>
          ))}
        </select>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className="flex-1 min-h-0">
        <ThreadedChat
          messages={messages}
          isLoading={isLoading || isSending}
          currentResponse=""
          send={handleSend}
          showComposer={Boolean(selectedRoom)}
          placeholder={env.placeholder}
          renderMessage={(message) => {
            const own = message.user === env.userId;
            return (
              <div className={cn(styles.messageRow, own ? styles.messageRowUser : styles.messageRowPeer)}>
                <div className={own ? styles.userBubble : styles.peerBubble}>
                  {!own ? <div className={styles.peerUser}>{message.user}</div> : null}
                  <div className={styles.messageText}>{message.content}</div>
                </div>
              </div>
            );
          }}
          renderLoading={() => <div className={styles.loading}>Loading messages...</div>}
          intro={
            <div className={styles.emptyState}>
              {selectedRoom
                ? "No messages yet. Start the conversation."
                : "No rooms available for this user."}
            </div>
          }
        />
      </div>
    </div>
  );
};

export { ChatView };
