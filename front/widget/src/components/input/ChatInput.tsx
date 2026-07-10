import { h } from 'preact';
import { useRef, useState, useEffect, useCallback } from 'preact/hooks';
import styles from './ChatInput.module.css';
import { Send, FileStack, ArrowRightFromLine } from 'lucide-preact';
import { IconButton, ButtonSize } from '../icon-button/IconButton';
import ScrollBar from '../scroll-bar/ScrollBar';

interface ChatInputProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: (text: string) => void;
  canSend: boolean;
  isMulti?: boolean;
  className?: string;
  textareaClassName?: string;
  actionsClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  inputRef?: (node: HTMLTextAreaElement | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onAttachClick?: () => void;
  onArrowClick?: () => void;
  variant?: 'default' | 'panel';
}

const joinClasses = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function ChatInput({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  isMulti = false,
  className,
  textareaClassName,
  actionsClassName,
  placeholder = 'Напишите сообщение...',
  autoFocus = false,
  inputRef,
  onFocus,
  onBlur,
  onAttachClick,
  onArrowClick,
  variant = 'default',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isExpanded, setIsExpanded] = useState(isMulti);
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
    const node = textareaRef.current;
    if (!node) return;
    commitMetrics({
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    });
  }, [commitMetrics]);

  const scheduleScrollMetrics = useCallback(() => {
    const node = textareaRef.current;
    if (!node) return;

    const nextMetrics = {
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    };
    metricsRef.current = nextMetrics;

    if (rafIdRef.current !== null) return;

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

  useEffect(() => {
    syncScrollMetrics();
    const node = textareaRef.current;
    if (!node) return;

    if (userText === '') {
      setIsExpanded(false);
    } else {
      if (node.scrollHeight > node.clientHeight) {
        setIsExpanded(true);
      }
    }
  }, [userText, syncScrollMetrics]);

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
    const node = textareaRef.current;
    if (!node) return;
    const max = node.scrollHeight - node.clientHeight;
    node.scrollTop = Math.max(0, Math.min(value, max));
  }, []);

  const handleSend = () => {
    if (userText.trim()) {
      onSendMessage(userText.trim());
      setUserText('');
    }
  };

  const maxScroll = Math.max(scrollMetrics.scrollHeight - scrollMetrics.clientHeight, 0);
  const scrollValue = Math.min(scrollMetrics.scrollTop, maxScroll);
  const thumbRatio = scrollMetrics.scrollHeight <= 0
    ? 1
    : Math.min(1, scrollMetrics.clientHeight / scrollMetrics.scrollHeight);

  const showScrollBar = isExpanded && maxScroll > 0;

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const setTextareaRef = useCallback((node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    inputRef?.(node);
  }, [inputRef]);

  const containerClassName = joinClasses(
    styles.inputContainer,
    isExpanded && styles.inputContainerMulti,
    variant === 'panel' && styles.panelVariant,
    className
  );

  const messageInputClassName = joinClasses(
    styles.messageInput,
    textareaClassName
  );

  const actionsClassNames = joinClasses(
    styles.actions,
    actionsClassName
  );

  const handleArrowClick = () => {
    if (onArrowClick) {
      onArrowClick();
      return;
    }
    handleSend();
  };

  const handleAttachClick = () => {
    if (onAttachClick) {
      onAttachClick();
      return;
    }
    handleSend();
  };

  return (
    <div className={containerClassName}>
      {showScrollBar && (
        <div className={styles.scrollBarContainer}>
          <ScrollBar
            orientation="vertical"
            value={scrollValue}
            min={0}
            max={maxScroll}
            step={1}
            onValueChange={handleScrollBarChange}
            ariaLabel="Прокрутка ввода"
            className={styles.scrollBarInstance}
            thumbRatio={thumbRatio}
            minThumbPercent={18}
          />
        </div>
      )}
      <textarea
        ref={setTextareaRef}
        value={userText}
        onScroll={handleScroll}
        onInput={(event) => setUserText((event.target as HTMLTextAreaElement).value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && userText.trim()) {
            event.preventDefault();
            handleSend();
          }
        }}
        className={messageInputClassName}
        placeholder={placeholder}
        rows={1}
        disabled={false}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <div className={actionsClassNames}>
        <IconButton
          onClick={handleArrowClick}
          icon={ArrowRightFromLine}
          size={ButtonSize.Small}
          ariaLabel="Отправить сообщение"
          disabled={!userText.trim()}
        />
        {onAttachClick && (
          <IconButton
            onClick={handleAttachClick}
            icon={FileStack}
            size={ButtonSize.Small}
            ariaLabel="Прикрепить файл"
            disabled={!canSend}
          />
        )}
        <IconButton
          onClick={handleSend}
          icon={Send}
          size={ButtonSize.Small}
          ariaLabel="Отправить сообщение"
          disabled={!canSend || !userText.trim()}
        />
      </div>
    </div>
  );
}