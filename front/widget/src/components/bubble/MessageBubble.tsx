import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { type RefObject } from 'preact';
import styles from './MessageBubble.module.css';
import TypographyMarkdown from '../typography/TypographyMarkdown.tsx';
import { renderUserBubbleHighlight } from './renderUserBubbleHighlight';

interface MessageBubbleProps {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  variant?: 'default' | 'transcript';
}

const joinClasses = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export default function MessageBubble({ sender, text, timestamp, variant = 'default' }: MessageBubbleProps) {
  const isUser = sender === 'user';
  const isTranscript = variant === 'transcript';
  const bubbleRef = useRef<HTMLDivElement>(null);
  const containerClasses = joinClasses(
    styles.messageContainer,
    isUser ? styles.userMessage : styles.assistantMessage,
    isTranscript && styles.messageContainerTranscript
  );
  const wrapperClasses = joinClasses(
    styles.bubbleWrapper,
    isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant,
    isTranscript && (
      isUser ? styles.bubbleWrapperUserTranscript : styles.bubbleWrapperAssistantTranscript
    ),
  );
  const bubbleClasses = joinClasses(
    styles.messageBubble,
    isUser ? styles.userBubble : styles.assistantBubble,
    isTranscript && styles.messageBubbleTranscript
  );

  const isBracketedMessage = text.startsWith('[') && text.endsWith(']');
  const displayContent = isBracketedMessage ? text.slice(1, -1) : text;

  return (
    <div className={containerClasses}>
      <div className={wrapperClasses}>
        <div ref={bubbleRef} className={bubbleClasses}>
          {isUser && (
            <BubbleHighlightCanvas
              targetRef={bubbleRef}
              variant={variant}
            />
          )}
          <TypographyMarkdown
            source={displayContent}
            isBracketed={isBracketedMessage}
            density="dense"
          />
        </div>
        {variant === 'default' && (
          <div className={styles.timestampHint}>
            <span>{timestamp}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface BubbleHighlightCanvasProps {
  targetRef: RefObject<HTMLDivElement>;
  variant: 'default' | 'transcript';
}

function BubbleHighlightCanvas({ targetRef, variant }: BubbleHighlightCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const target = targetRef.current;
    const canvas = canvasRef.current;
    if (!target || !canvas) {
      return;
    }

    const draw = () => {
      renderUserBubbleHighlight(canvas, target, variant);
    };

    draw();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        draw();
      });

      observer.observe(target);

      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener('resize', draw);
    return () => {
      window.removeEventListener('resize', draw);
    };
  }, [targetRef, variant]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.bubbleHighlightCanvas}
      aria-hidden="true"
    />
  );
}
