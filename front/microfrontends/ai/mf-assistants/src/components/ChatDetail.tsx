import React, { useCallback } from 'react';
import { Bot, Braces, FileDown } from 'lucide-react';
import {
  ThreadedChat,
  cn,
  useMicrofrontendTranslation,
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

const ToolCallMessage: React.FC<{
  message: ChatMessage;
  onOpenJson: (toolCall: NonNullable<ChatMessage['toolCallData']>) => void;
}> = ({ message, onOpenJson }) => {
  const toolCall = message.toolCallData;
  if (!toolCall) return <MessageBubble message={message} />;

  const toolCallId = toolCall.toolCallId ? toolCall.toolCallId.slice(0, 12) : undefined;

  return (
    <div className={cn(styles.messageRow, styles.messageRowAssistant)}>
      <div className={styles.assistantText}>
        <div className={styles.messageHeader}>
          <Bot size={14} />
        </div>
        <div className={styles.toolCallCard}>
          <div className={styles.toolCallTitleRow}>
            <span className={styles.toolCallTitle}>{toolCall.title}</span>
            {toolCallId ? <span className={styles.toolCallMeta}>#{toolCallId}</span> : null}
          </div>
          {toolCall.summary ? (
            <div className={styles.toolCallSummary}>{toolCall.summary}</div>
          ) : (
            <div className={styles.toolCallSummary}>Вызов функции выполнен.</div>
          )}
          <button
            type="button"
            className={styles.toolCallLink}
            onClick={() => onOpenJson(toolCall)}
          >
            <Braces size={14} />
            <span>JSON</span>
          </button>
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
        className={styles.fileBubble}
      >
        <div className={styles.fileBubbleInner}>
          <FileDown className="h-4 w-4 text-primary shrink-0" />
          <span className={styles.fileName}>{fileName}</span>
          {fileSize && (
            <span className={styles.fileSize}>{formatFileSize(fileSize)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================
// Маппинг имени инструмента → ключ локали
// ==========================
function getActionKey(toolName: string): string {
  const n = toolName.toLowerCase();
  if (n.includes('request') || n.includes('order')) return 'toolAction.request';
  if (n.includes('file') || n.includes('upload') || n.includes('download') || n.includes('attach') || n.includes('storage')) return 'toolAction.file';
  if (n.includes('search') || n.includes('find') || n.includes('query') || n.includes('lookup')) return 'toolAction.search';
  if (n.includes('analyz') || n.includes('extract') || n.includes('detect') || n.includes('parse')) return 'toolAction.analyze';
  if (n.includes('convert') || n.includes('transform') || n.includes('render')) return 'toolAction.convert';
  if (n.includes('update') || n.includes('patch') || n.includes('modify') || n.includes('edit') || n.includes('set')) return 'toolAction.update';
  if (n.includes('create') || n.includes('save') || n.includes('write') || n.includes('add') || n.includes('insert') || n.includes('register')) return 'toolAction.create';
  if (n.includes('get') || n.includes('read') || n.includes('fetch') || n.includes('load') || n.includes('list') || n.includes('show')) return 'toolAction.load';
  if (n.includes('delete') || n.includes('remove') || n.includes('drop')) return 'toolAction.delete';
  if (n.includes('send') || n.includes('notify') || n.includes('message') || n.includes('email')) return 'toolAction.notify';
  return 'toolAction.thinking';
}

// ==========================
// Компонент индикатора загрузки
// ==========================
const LoadingIndicator: React.FC<{ toolName?: string }> = ({ toolName }) => {
  const { t } = useMicrofrontendTranslation('assistants-mf');
  const actionKey = toolName ? getActionKey(toolName) : 'toolAction.thinking';
  const actionText = t(actionKey);

  return (
    <div className={cn(styles.messageRow, styles.messageRowAssistant)}>
      <div className={styles.assistantText}>
        <div className={styles.messageHeader}>
          <Bot size={14} />
        </div>
        <div className={styles.loadingWrap}>
          <div className={styles.loadingDots}>
            <div className={styles.loadingDot} />
            <div className={styles.loadingDot} />
            <div className={styles.loadingDot} />
          </div>
          {actionText ? (
            <span className={styles.loadingActionText}>{actionText}</span>
          ) : null}
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
  lastToolCallName?: string;
  send: (content: string) => void;
  onFilesSelected?: (files: File[]) => void;
  files?: FileListItem[];
  showComposer?: boolean;
  intro?: React.ReactNode;
  onOpenToolCallJson?: (toolCall: NonNullable<ChatMessage['toolCallData']>) => void;
}) => {
  const showIntro =
    Boolean(props.intro) &&
    props.messages.length === 0 &&
    !props.isLoading &&
    !props.currentResponse;

  return (
    <ThreadedChat
      className={styles.chatRoot}
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
        if (message.toolCallData) {
          return (
            <ToolCallMessage
              message={message}
              onOpenJson={(toolCall) => props.onOpenToolCallJson?.(toolCall)}
            />
          );
        }
        return <MessageBubble message={message} />;
      }}
      renderStreaming={(content) => <StreamingMessage content={content} />}
      renderLoading={() => <LoadingIndicator toolName={props.lastToolCallName} />}
    />
  );
};

export { ChatDetail, MessageBubble, StreamingMessage, LoadingIndicator };
