import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";
import type { ThreadMessageBase } from "./types";
import { buildThreadTree } from "./thread-tree";
import styles from "./ThreadedChat.module.css";

type ThreadedChatProps<TMessage extends ThreadMessageBase> = {
  messages: TMessage[];
  isLoading: boolean;
  currentResponse?: string;
  send: (content: string) => void;
  renderMessage: (message: TMessage, ctx: { depth: number }) => React.ReactNode;
  renderStreaming?: (content: string) => React.ReactNode;
  renderLoading?: () => React.ReactNode;
  intro?: React.ReactNode;
  showComposer?: boolean;
  placeholder?: string;
  onFilesSelected?: (files: File[]) => void;
  files?: React.ReactNode;
  className?: string;
  getParentId?: (message: TMessage) => string | undefined;
  getTimestamp?: (message: TMessage) => number | undefined;
  indentSize?: number;
};

export function ThreadedChat<TMessage extends ThreadMessageBase>({
  messages,
  isLoading,
  currentResponse = "",
  send,
  renderMessage,
  renderStreaming,
  renderLoading,
  intro,
  showComposer = true,
  placeholder = "Write a message...",
  onFilesSelected,
  files,
  className,
  getParentId,
  getTimestamp,
  indentSize = 14,
}: ThreadedChatProps<TMessage>) {
  const [inputValue, setInputValue] = useState("");
  const [composerFocused, setComposerFocused] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orderedMessages = useMemo(
    () => buildThreadTree(messages, { getParentId, getTimestamp }),
    [messages, getParentId, getTimestamp],
  );

  const showIntro =
    Boolean(intro) &&
    orderedMessages.length === 0 &&
    !isLoading &&
    !currentResponse;

  useEffect(() => {
    if (!scrollAreaRef.current) return;
    const viewport = scrollAreaRef.current.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [orderedMessages, currentResponse, isLoading]);

  const handleSend = useCallback(() => {
    const content = inputValue.trim();
    if (!content || isLoading) return;
    send(content);
    setInputValue("");
  }, [inputValue, isLoading, send]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = Array.from(event.currentTarget.files ?? []);
      if (selected.length > 0 && onFilesSelected) {
        onFilesSelected(selected);
      }
      event.currentTarget.value = "";
    },
    [onFilesSelected],
  );

  return (
    <div className={cn("flex h-full w-full max-w-2xl mx-auto flex-col", className)}>
      <Card className="flex flex-col h-full rounded-none border-none shadow-none">
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="h-full w-full">
            <div className={styles.chatScroll}>
              <div
                className={cn(
                  styles.chatMessages,
                  showIntro ? styles.chatMessagesIntro : undefined,
                )}
              >
                {showIntro ? intro : null}
                {orderedMessages.map((item) => (
                  <div
                    key={`${item.message.id}:${item.index}`}
                    className={styles.threadMessage}
                    style={{ paddingInlineStart: `${item.depth * indentSize}px` }}
                  >
                    {renderMessage(item.message, { depth: item.depth })}
                  </div>
                ))}
                {isLoading && currentResponse
                  ? renderStreaming?.(currentResponse)
                  : null}
                {isLoading && !currentResponse ? renderLoading?.() : null}
              </div>
            </div>
          </ScrollArea>
        </CardContent>

        {showComposer || files ? (
          <CardFooter className={cn("shrink-0 flex-col gap-3", styles.composerFooter)}>
            {showComposer ? (
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            ) : null}
            {files ? <div className={styles.filesTray}>{files}</div> : null}
            {showComposer ? (
              <div
                className={cn(
                  styles.composerBar,
                  composerFocused || inputValue ? styles.composerBarExpanded : undefined,
                )}
              >
                <textarea
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setComposerFocused(true)}
                  onBlur={() => setComposerFocused(false)}
                  placeholder={placeholder}
                  className={cn(
                    "flex-1 resize-none p-0 m-0 text-sm",
                    styles.composerTextarea,
                  )}
                  rows={composerFocused || inputValue ? 3 : 1}
                  disabled={isLoading}
                  aria-label="Message"
                />
                <div className={styles.composerActions}>
                  {onFilesSelected ? (
                    <Button
                      type="button"
                      onClick={handleAttachClick}
                      disabled={isLoading}
                      size="icon"
                      variant="ghost"
                      className={styles.composerAction}
                      aria-label="Attach file"
                    >
                      <Paperclip size={16} />
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button
                    type="button"
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    size="icon"
                    variant="ghost"
                    className={styles.composerAction}
                    aria-label="Send"
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}

export type { ThreadedChatProps };
