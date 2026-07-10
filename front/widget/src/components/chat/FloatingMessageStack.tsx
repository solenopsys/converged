import { h } from 'preact';
import { ChatMessage } from 'front-chat-core';
import ChatContainer from './ChatContainer';
import styles from './FloatingMessageStack.module.css';

interface FloatingMessageStackProps {
  messages: ChatMessage[];
  currentResponse: string;
  isLoading: boolean;
  width: number;
  onMetricsChange?: (metrics: { scrollTop: number; scrollHeight: number; clientHeight: number }) => void;
  maxVisible?: number;
  descriptionText?: string;
}

const DEFAULT_DESCRIPTION_TEXT = 'Напишите сообщение, чтобы начать диалог.';

export function FloatingMessageStack({
  messages,
  currentResponse,
  isLoading,
  width,
  onMetricsChange,
  descriptionText,
}: FloatingMessageStackProps) {
  const shouldRenderStack = messages.length > 0 || isLoading || Boolean(currentResponse);

  if (!shouldRenderStack) {
    return null;
  }

  return (
    <div className={styles.stackHost} style={{ width: `${width}px` }}>
      <ChatContainer
        messages={messages}
        isLoading={isLoading}
        currentResponse={currentResponse}
        descriptionText={descriptionText ?? DEFAULT_DESCRIPTION_TEXT}
        onMetricsChange={onMetricsChange}
      />
    </div>
  );
}
