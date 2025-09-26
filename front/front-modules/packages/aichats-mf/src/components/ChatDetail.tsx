import React, { useState } from 'react';
import { Send, User, Bot } from 'lucide-react';
import { Button, Card, CardContent, CardFooter, ScrollArea, Avatar, AvatarFallback, cn, Textarea } from 'converged-core';
 
import { ChatMessage } from 'front-chat-core';

const ChatDetail: React.FC = (props: {
  messages: ChatMessage[];
  isLoading: boolean;
  currentResponse: string;
  send: (content: string) => void;
}) => {
  const [inputValue, setInputValue] = useState<string>('');

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
    <Card className="mx-auto h-full max-w-2xl flex flex-col">
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {props.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-3",
                  message.type === 'user' && "flex-row-reverse"
                )}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={cn(
                    message.type === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-secondary text-secondary-foreground"
                  )}>
                    {message.type === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={cn(
                    "max-w-xs lg:max-w-md rounded-lg px-4 py-2",
                    message.type === 'user'
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}

            {/* Current streaming response */}
            {props.isLoading && props.currentResponse && (
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-secondary text-secondary-foreground">
                    <Bot size={16} />
                  </AvatarFallback>
                </Avatar>
                <div className="max-w-xs lg:max-w-md rounded-lg bg-muted px-4 py-2 text-muted-foreground">
                  <p className="text-sm">{props.currentResponse}</p>
                  <div className="ml-1 inline-block h-4 w-1 animate-pulse bg-muted-foreground" />
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {props.isLoading && !props.currentResponse && (
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
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="border-t p-4">
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
  );
};

export { ChatDetail };