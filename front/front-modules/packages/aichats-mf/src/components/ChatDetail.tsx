import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  ScrollArea,
  Avatar,
  AvatarFallback,
  cn,
  Textarea
} from 'converged-core';
import ReactMarkdown from 'react-markdown';

import { ChatMessage } from 'front-chat-core';

// ==========================
// Общий класс для форматирования Markdown
// ==========================
const markdownClassName =
  // Базовые стили текста
  "text-sm p-4 leading-relaxed " +
  // Абзацы
  "[&_p]:mb-3 [&_p]:last:mb-0 " +
  // Заголовки
  "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 " +
  "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 " +
  "[&_h3]:text-base [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1 " +
  // Списки
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 " +
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 " +
  "[&_li]:mb-1 [&_li]:leading-snug";

// ==========================
// Компонент пузыря сообщения
// ==========================
interface MessageBubbleProps {
  message: ChatMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  return (
    <div
      className={cn(
        "flex items-start gap-3",
        message.type === 'user' && "flex-row-reverse"
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback
          className={cn(
            message.type === 'user'
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground"
          )}
        >
          {message.type === 'user' ? <User size={16} /> : <Bot size={16} />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "max-w-xs lg:max-w-md rounded-lg",
          message.type === 'user'
            ? "bg-primary text-primary-foreground ml-auto"
            : "bg-muted text-muted-foreground"
        )}
      >
        <div className={markdownClassName}>
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
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-secondary text-secondary-foreground">
          <Bot size={16} />
        </AvatarFallback>
      </Avatar>
      <div className="max-w-xs lg:max-w-md rounded-lg bg-muted text-muted-foreground">
        <div className={markdownClassName}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        <div className="ml-1 inline-block h-4 w-1 animate-pulse bg-muted-foreground" />
      </div>
    </div>
  );
};

// ==========================
// Компонент индикатора загрузки
// ==========================
const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-secondary text-secondary-foreground">
          <Bot size={16} />
        </AvatarFallback>
      </Avatar>
      <div className="max-w-xs lg:max-w-md rounded-lg bg-muted px-4 py-2 text-muted-foreground">
        <div className="flex space-x-1">
          <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
          <div
            className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: '0.1s' }}
          />
          <div
            className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: '0.2s' }}
          />
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
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Автоскролл к новым сообщениям
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [props.messages, props.currentResponse]);

  const handleSend = (): void => {
    if (!inputValue.trim() || props.isLoading) return;

    props.send(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full w-full max-w-2xl mx-auto flex-col">
      <Card className="flex flex-col h-full">
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea 
            ref={scrollAreaRef}
            className="h-full w-full"
          >
            <div className="space-y-4 p-4">
              {props.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {/* Текущий стриминговый ответ */}
              {props.isLoading && props.currentResponse && (
                <StreamingMessage content={props.currentResponse} />
              )}

              {/* Индикатор загрузки */}
              {props.isLoading && !props.currentResponse && (
                <LoadingIndicator />
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="border-t p-4 shrink-0">
          <div className="flex w-full gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите сообщение..."
              className="min-h-0 flex-1 resize-none"
              rows={1}
              disabled={props.isLoading}
              aria-label="Сообщение"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || props.isLoading}
              size="icon"
              aria-label="Отправить"
            >
              <Send size={16} />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export { ChatDetail, MessageBubble, StreamingMessage, LoadingIndicator };