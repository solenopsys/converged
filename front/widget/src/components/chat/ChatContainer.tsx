import { h } from 'preact';
import { useEffect, useMemo, useRef, useState, useCallback } from 'preact/hooks';
import { Bot, CircleUserRound } from 'lucide-preact';
import MessageBubble from '../bubble/MessageBubble';
import FileLinkMessage from './FileLinkMessage';
import ScrollBar from '../scroll-bar/ScrollBar';
import { ChatMessage } from 'front-chat-core';
import styles from './ChatContainer.module.css';

const ICON_SIZE = 16;

export interface ChatContainerProps {
  messages: ChatMessage[];
  isLoading: boolean;
  currentResponse: string;
  descriptionText: string;
  onMetricsChange?: (metrics: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
  }) => void;
}

export default function ChatContainer({
  messages,
  isLoading,
  currentResponse,
  descriptionText,
  onMetricsChange,
}: ChatContainerProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [scrollMetrics, setScrollMetrics] = useState({
    scrollTop: 0,
    scrollHeight: 1,
    clientHeight: 1,
  });

  const metricsRef = useRef(scrollMetrics);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    metricsRef.current = scrollMetrics;
  }, [scrollMetrics]);

  const commitMetrics = useCallback((next: typeof scrollMetrics) => {
    metricsRef.current = next;
    setScrollMetrics((prev) => {
      if (
        prev.scrollTop === next.scrollTop &&
        prev.scrollHeight === next.scrollHeight &&
        prev.clientHeight === next.clientHeight
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const syncScrollMetrics = useCallback(() => {
    const node = transcriptRef.current;
    if (!node) {
      return;
    }

    commitMetrics({
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    });
  }, [commitMetrics]);

  const scheduleScrollMetrics = useCallback(() => {
    const node = transcriptRef.current;
    if (!node) {
      return;
    }

    const nextMetrics = {
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    };

    metricsRef.current = nextMetrics;

    if (rafIdRef.current !== null) {
      return;
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      setScrollMetrics((prev) => {
        const latest = metricsRef.current;
        if (
          prev.scrollTop === latest.scrollTop &&
          prev.scrollHeight === latest.scrollHeight &&
          prev.clientHeight === latest.clientHeight
        ) {
          return prev;
        }
        return latest;
      });
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    const node = transcriptRef.current;
    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
    syncScrollMetrics();
  }, [syncScrollMetrics]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponse, scrollToBottom]);

  useEffect(() => {
    syncScrollMetrics();
  }, [messages, currentResponse, syncScrollMetrics]);

  useEffect(() => {
    syncScrollMetrics();
  }, [syncScrollMetrics]);

  useEffect(() => {
    if (!onMetricsChange) {
      return;
    }

    onMetricsChange({
      scrollTop: scrollMetrics.scrollTop,
      scrollHeight: scrollMetrics.scrollHeight,
      clientHeight: scrollMetrics.clientHeight,
    });
  }, [scrollMetrics, onMetricsChange]);

  useEffect(() => () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const handleScroll = useCallback(() => {
    scheduleScrollMetrics();
  }, [scheduleScrollMetrics]);

  const handleScrollBarChange = useCallback((value: number) => {
    const node = transcriptRef.current;
    if (!node) {
      return;
    }

    const max = node.scrollHeight - node.clientHeight;
    node.scrollTop = Math.max(0, Math.min(value, max));
  }, []);

  const maxScroll = Math.max(scrollMetrics.scrollHeight - scrollMetrics.clientHeight, 0);
  const scrollValue = Math.min(scrollMetrics.scrollTop, maxScroll);
  const thumbRatio = scrollMetrics.scrollHeight <= 0
    ? 1
    : Math.min(1, scrollMetrics.clientHeight / scrollMetrics.scrollHeight);

  const hasAssistantMessage = messages.some(
    message => message.type === 'assistant' && message.content && message.content.trim() !== ''
  );

  const formattedMessages = useMemo(
    () =>
      messages.map((message) => ({
        message,
        formattedTime: formatTimestamp(message),
      })),
    [messages],
  );

  const showEmptyState = messages.length === 0 && !isLoading && !currentResponse;

  return (
    <div className={styles.transcriptContainer}>
      <div className={styles.transcriptWrapper}>
        <div
          ref={transcriptRef}
          className={styles.transcriptContent}
          onScroll={handleScroll}
        >
          {showEmptyState && (
            <div className={styles.transcriptEmpty}>
              <p>{descriptionText}</p>
            </div>
          )}

          {!showEmptyState && (
            <div className={styles.messageList}>
              {formattedMessages.map(({ message, formattedTime }) => (
                <div
                  key={message.id}
                  className={`${styles.messageRow} ${message.type === 'user' ? styles.userRow : styles.assistantRow}`}
                >
                  <div className={styles.messageHeader}>
                    <div className={styles.avatar}>
                      {message.type === 'user' ? <CircleUserRound size={ICON_SIZE} /> : <Bot size={ICON_SIZE} />}
                    </div>
                    <span className={styles.timestamp}>{formattedTime}</span>
                  </div>
                  <div className={styles.messageBody}>
                    {message.fileData ? (
                      <FileLinkMessage
                        fileId={message.fileData.fileId}
                        fileName={message.fileData.fileName}
                        fileSize={message.fileData.fileSize}
                        fileType={message.fileData.fileType}
                      />
                    ) : (
                      <MessageBubble
                        sender={message.type as 'user' | 'assistant'}
                        text={message.content}
                        timestamp={formattedTime}
                        variant="transcript"
                      />
                    )}
                  </div>
                </div>
              ))}

              {isLoading && currentResponse && (() => {
                const timestamp = formatTimestamp();
                return (
                  <div className={`${styles.messageRow} ${styles.assistantRow}`}>
                    <div className={styles.messageHeader}>
                      <div className={styles.avatar}>
                        <Bot size={ICON_SIZE} />
                      </div>
                      <span className={styles.timestamp}>{timestamp}</span>
                    </div>
                    <div className={styles.messageBody}>
                      <MessageBubble
                        sender="assistant"
                        text={currentResponse}
                        timestamp={timestamp}
                        variant="transcript"
                      />
                    </div>
                  </div>
                );
              })()}

              {isLoading && !hasAssistantMessage && !currentResponse && (() => {
                const timestamp = formatTimestamp();
                return (
                  <div className={`${styles.messageRow} ${styles.assistantRow}`}>
                    <div className={styles.messageHeader}>
                      <div className={styles.avatar}>
                        <Bot size={ICON_SIZE} />
                      </div>
                      <span className={styles.timestamp}>{timestamp}</span>
                    </div>
                    <div className={styles.messageBody}>
                      <div className={styles.loadingBubble}>
                        <div className={styles.loadingIndicator}>
                          <div className={`${styles.loadingDot} ${styles.dot1}`} />
                          <div className={`${styles.loadingDot} ${styles.dot2}`} />
                          <div className={`${styles.loadingDot} ${styles.dot3}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        {maxScroll > 0 && (
          <div className={styles.scrollBarContainer}>
            <ScrollBar
              orientation="vertical"
              value={scrollValue}
              min={0}
              max={maxScroll}
              step={1}
              onValueChange={handleScrollBarChange}
              ariaLabel="Прокрутка сообщений"
              className={styles.scrollBarInstance}
              thumbRatio={thumbRatio}
              minThumbPercent={18}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(message?: ChatMessage) {
  const raw = message && ('timestamp' in message ? message.timestamp : (message as any)?.createdAt);

  if (typeof raw === 'number') {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(raw));
  }

  if (typeof raw === 'string') {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    }
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}
