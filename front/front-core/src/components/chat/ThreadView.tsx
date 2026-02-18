import React from "react";
import { cn } from "../../lib/utils";
import { ThreadedChat } from "./ThreadedChat";
import type { ThreadMessageBase } from "./types";
import styles from "./ThreadView.module.css";

export type ThreadViewMessage = ThreadMessageBase & {
  user?: string;
  data?: string;
  content?: string;
};

type ThreadViewProps<TMessage extends ThreadViewMessage> = {
  messages: TMessage[];
  isLoading?: boolean;
  currentUserId?: string;
  className?: string;
  emptyText?: string;
  loadingText?: string;
  getContent?: (message: TMessage) => string;
  getUserId?: (message: TMessage) => string | undefined;
  getParentId?: (message: TMessage) => string | undefined;
  getTimestamp?: (message: TMessage) => number | undefined;
};

export function ThreadView<TMessage extends ThreadViewMessage>({
  messages,
  isLoading = false,
  currentUserId,
  className,
  emptyText = "No messages yet.",
  loadingText = "Loading messages...",
  getContent = (message) => message.content ?? message.data ?? "",
  getUserId = (message) => message.user,
  getParentId,
  getTimestamp,
}: ThreadViewProps<TMessage>) {
  return (
    <ThreadedChat
      className={cn(styles.container, className)}
      messages={messages}
      isLoading={isLoading}
      currentResponse=""
      send={() => {}}
      showComposer={false}
      getParentId={getParentId}
      getTimestamp={getTimestamp}
      renderMessage={(message) => {
        const userId = getUserId(message);
        const own = Boolean(currentUserId) && userId === currentUserId;
        const content = getContent(message);

        return (
          <div
            className={cn(
              styles.messageRow,
              own ? styles.messageRowOwn : styles.messageRowPeer,
            )}
          >
            <div className={own ? styles.ownBubble : styles.peerBubble}>
              {!own && userId ? <div className={styles.author}>{userId}</div> : null}
              <div className={styles.content}>{content}</div>
            </div>
          </div>
        );
      }}
      renderLoading={() => <div className={styles.loading}>{loadingText}</div>}
      intro={<div className={styles.empty}>{emptyText}</div>}
    />
  );
}

export type { ThreadViewProps };
