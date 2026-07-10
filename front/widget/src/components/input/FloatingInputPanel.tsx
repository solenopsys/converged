import { useEffect, useRef, useCallback } from 'preact/hooks';
import styles from './FloatingInputPanel.module.css';
import { Bot } from 'lucide-preact';
import ChatInput from './ChatInput';
import FileList, { type FileListItem } from '../files/FileList';

interface FloatingInputPanelProps {
  isOpen: boolean;
  isExpanded: boolean;
  userText: string;
  canSend: boolean;
  width: number;
  onOpen: () => void;
  onClose: () => void;
  onSend: (text: string) => void;
  onTextChange: (text: string) => void;
  onExpandedChange: (expanded: boolean) => void;
  onAttachFiles: (files: File[]) => void;
  files?: FileListItem[];
}

const EXPAND_TRIGGER_LENGTH = 80;

export function FloatingInputPanel({
  isOpen,
  isExpanded,
  userText,
  canSend,
  width,
  onOpen,
  onClose,
  onSend,
  onTextChange,
  onExpandedChange,
  onAttachFiles,
  files = [],
}: FloatingInputPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeFiles = files.filter((file) => file.status !== "uploaded");

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!isExpanded && (userText.includes('\n') || userText.length > EXPAND_TRIGGER_LENGTH)) {
      onExpandedChange(true);
      return;
    }

    if (isExpanded && userText.trim().length === 0) {
      onExpandedChange(false);
    }
  }, [isOpen, isExpanded, userText, onExpandedChange]);

  const handleSend = () => {
    const message = userText.trim();
    if (!canSend || message.length === 0) {
      return;
    }

    onSend(message);
    onTextChange('');
    onExpandedChange(false);
  };

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputRef = useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
  }, []);

  if (!isOpen) {
    return (
      <button
        type="button"
        className={styles.fabButton}
        onClick={onOpen}
        aria-label="Открыть поле ввода"
      >
        <Bot size={32} />
      </button>
    );
  }

  return (
    <div
      className={`${styles.panel} ${isExpanded ? styles.expanded : styles.compact}`}
      style={{ width: `${width}px` }}
    >

        {isExpanded && <div className={styles.scrollIndicator} aria-hidden="true" />}
        <ChatInput
          userText={userText}
          setUserText={onTextChange}
          onSendMessage={handleSend}
          canSend={canSend}
          isMulti={isExpanded}
          autoResize
          minRows={isExpanded ? 3 : 1}
          maxRows={isExpanded ? 6 : 3}
          inputRef={handleInputRef}
          onAttachClick={handleAttachClick}
          variant="panel"
          placeholder="Напишите сообщение..."
        />
        {activeFiles.length > 0 && (
          <div className={styles.filesSection}>
            <FileList items={activeFiles} />
          </div>
        )}


      <input
        ref={fileInputRef}
        type="file"
        multiple
        className={styles.hiddenFileInput}
        onChange={(event) => {
          const selectedFiles = Array.from(event.currentTarget.files ?? []);
          if (selectedFiles.length > 0) {
            onAttachFiles(selectedFiles);
          }
          event.currentTarget.value = '';
        }}
      />

    </div>
  );
}
