import React, { useCallback } from 'react';
import { Bot, FileDown } from 'lucide-react';
import {
  ThreadedChat,
  cn
} from 'front-core';
import ReactMarkdown from 'react-markdown';

import { ChatMessage } from 'assistant-state';
import type { FileListItem } from 'files-state';
import { downloadRequested } from 'files-state';
import { FileList } from './files';
import styles from './ChatDetail.module.css';

// ==========================
// Компонент сообщения
// ==========================
interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.type === 'user';

  if (isUser) {
    // Юзер справа в пузыре
    return (
      <div className={cn(styles.messageRow, styles.messageRowUser)}>
        <div className={styles.userBubble}>
          {message.content}
        </div>
      </div>
    );
  }

  // Бот слева без пузыря
  return (
    <div className={cn(styles.messageRow, styles.messageRowAssistant)}>
      <div className={styles.assistantText}>
        <div className={styles.messageHeader}>
          <Bot size={14} />
        </div>
        <div className={styles.markdown}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

// ==========================
// Компонент для стримингового ответа
// ==========================
interface StreamingMessageProps {
  content: string;
}

const StreamingMessage: React.FC<StreamingMessageProps> = ({ content }) => {
  return (
    <div className={cn(styles.messageRow, styles.messageRowAssistant)}>
      <div className={styles.assistantText}>
        <div className={styles.messageHeader}>
          <Bot size={14} />
        </div>
        <div className={styles.markdown}>
          <ReactMarkdown>{content}</ReactMarkdown>
          <span className={styles.streamCursor} />
        </div>
      </div>
    </div>
  );
};

// ==========================
// Компонент для отображения ссылки на файл
// ==========================
interface FileLinkMessageProps {
  fileId: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
}

const FileLinkMessage: React.FC<FileLinkMessageProps> = ({ fileId, fileName, fileSize }) => {
  const handleDownload = useCallback(() => {
    downloadRequested({ fileId, fileName });
  }, [fileId, fileName]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn(styles.messageRow, styles.messageRowUser)}>
      <div
        onClick={handleDownload}
        className="max-w-[75%] rounded-2xl rounded-tr-sm bg-primary/10 border border-primary/20 px-3 py-2 cursor-pointer hover:bg-primary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileDown className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">{fileName}</span>
          {fileSize && (
            <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(fileSize)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================
// Компонент индикатора загрузки
// ==========================
const LoadingIndicator: React.FC = () => {
  return (
    <div className={cn(styles.messageRow, styles.messageRowAssistant)}>
      <div className={styles.assistantText}>
        <div className={styles.messageHeader}>
          <Bot size={14} />
        </div>
        <div className={styles.loadingDots}>
          <div className={styles.loadingDot} />
          <div className={styles.loadingDot} />
          <div className={styles.loadingDot} />
        </div>
      </div>
    </div>
  );
};

// ==========================
// Основной компонент ChatDetail
// ==========================
const ChatDetail: React.FC = (props: {
  messages: ChatMessage[];
  isLoading: boolean;
  currentResponse: string;
  send: (content: string) => void;
  onFilesSelected?: (files: File[]) => void;
  files?: FileListItem[];
  showComposer?: boolean;
  intro?: React.ReactNode;
}) => {
  const showIntro =
    Boolean(props.intro) &&
    props.messages.length === 0 &&
    !props.isLoading &&
    !props.currentResponse;

  return (
    <ThreadedChat
      messages={props.messages}
      isLoading={props.isLoading}
      currentResponse={props.currentResponse}
      send={props.send}
      showComposer={props.showComposer ?? true}
      onFilesSelected={props.onFilesSelected}
      files={props.files && props.files.length > 0 ? <FileList items={props.files} /> : null}
      intro={showIntro ? props.intro : null}
      placeholder="Напишите сообщение..."
      renderMessage={(message) => {
        if (message.fileData) {
          return (
            <FileLinkMessage
              fileId={message.fileData.fileId}
              fileName={message.fileData.fileName}
              fileSize={message.fileData.fileSize}
              fileType={message.fileData.fileType}
            />
          );
        }
        return <MessageBubble message={message} />;
      }}
      renderStreaming={(content) => <StreamingMessage content={content} />}
      renderLoading={() => <LoadingIndicator />}
    />
  );
};

export { ChatDetail, MessageBubble, StreamingMessage, LoadingIndicator };
