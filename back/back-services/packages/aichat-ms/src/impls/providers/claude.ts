import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";

import { 
    StreamEvent, 
    EventHandler, 
    AiConversation, 
    MessageSource, 
    LogFunction, 
    ConversationOptions, 
    ContentBlock, 
    ContentType 
} from "../../types";
import { StreamEventType } from "../../types";

// Обработчик текстовых дельт
class ClaudeTextDeltaHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "content_block_delta" && 
               this.hasTextDelta(eventType);
    }
    
    private hasTextDelta(event: any): boolean {
        return event?.delta?.type === "text_delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent {
        return {
            type: StreamEventType.TEXT_DELTA,
            content: event.delta?.text || "",
            tokens: totalTokens
        };
    }
}

// Обработчик вызовов функций
class ClaudeToolCallHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "content_block_start" || 
               eventType === "content_block_delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        // Начало tool use блока
        if (event.type === "content_block_start" && 
            event.content_block?.type === "tool_use") {
            return {
                type: StreamEventType.TOOL_CALL,
                id: event.content_block.id,
                name: event.content_block.name,
                args: {},
                tokens: totalTokens
            };
        }
        
        // Дельта для input параметров
        if (event.type === "content_block_delta" && 
            event.delta?.type === "input_json_delta") {
            return {
                type: StreamEventType.TOOL_CALL,
                id: event.index?.toString() || randomUUID(),
                name: "",
                args: event.delta.partial_json || "",
                tokens: totalTokens
            };
        }
        
        return null;
    }
}

// Обработчик завершения
class ClaudeCompletionHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "message_stop";
    }
    
    handle(event: any, totalTokens: number): StreamEvent {
        return {
            type: StreamEventType.COMPLETED,
            finishReason: event.stop_reason || "end_turn",
            tokens: totalTokens
        };
    }
}

// Обработчик ошибок
class ClaudeErrorHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "error";
    }
    
    handle(event: any, totalTokens: number): StreamEvent {
        return {
            type: StreamEventType.ERROR,
            message: event.error?.message || "Unknown error",
            tokens: totalTokens
        };
    }
}

// Реализация для Claude
export class ClaudeConversation implements AiConversation {
    private id: string;
    private model: string;
    private anthropic: Anthropic;
    private log: LogFunction;
    private handlers: EventHandler[] = [
        new ClaudeTextDeltaHandler(),
        new ClaudeToolCallHandler(),
        new ClaudeCompletionHandler(),
        new ClaudeErrorHandler()
    ];
    
    constructor(model: string, apiKey: string, log: LogFunction) {
        this.id = randomUUID();
        this.model = model;
        this.anthropic = new Anthropic({ apiKey });
        this.log = log;
    }
    
    getId(): string {
        return this.id;
    }
    
    async* send(
        messages: ContentBlock[],
        options?: ConversationOptions
    ): AsyncIterable<StreamEvent> {
        try {
            // Логируем входящие сообщения пользователя
            await Promise.all(
                messages.map(msg => this.log(msg, MessageSource.USER))
            );

            // Преобразуем ContentBlock[] в формат Claude
            const claudeMessages = this.convertToClaudeFormat(messages);
            
            // Извлекаем system сообщение если есть
            const systemMessage = claudeMessages.find(msg => msg.role === "system");
            const conversationMessages = claudeMessages.filter(msg => msg.role !== "system");

            // Создаем стрим через Claude Messages API
            const stream = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: options?.maxTokens || 4096,
                messages: conversationMessages,
                system: systemMessage?.content as string,
                stream: true,
                tools: options?.tools,
                temperature: options?.temperature,
                top_p: options?.top_p,
                top_k: options?.top_k,
                ...options
            });

            let totalTokens = 0;

            // Обрабатываем события от Claude
            for await (const event of stream) {
                const claudeEvent = event as any;
                const eventType = claudeEvent.type;

                // Извлекаем токены из usage если есть
                if (claudeEvent.usage) {
                    totalTokens = (claudeEvent.usage.input_tokens || 0) + 
                                 (claudeEvent.usage.output_tokens || 0);
                }

                // Логируем все события от ассистента
                await this.log(claudeEvent, MessageSource.ASSISTANT);

                // Ищем подходящий хендлер
                const handler = this.handlers.find(h => h.canHandle(eventType));
                if (handler) {
                    const result = handler.handle(claudeEvent, totalTokens);
                    if (result) {
                        yield result;
                        
                        // Завершаем если это completion или error
                        if (result.type === StreamEventType.COMPLETED || 
                            result.type === StreamEventType.ERROR) {
                            return;
                        }
                    }
                }
            }

        } catch (error: any) {
            // Логируем ошибку
            await this.log({ error: error.message }, MessageSource.ASSISTANT);
            
            yield {
                type: StreamEventType.ERROR,
                message: error?.message || "Request failed",
                tokens: 0
            };
        }
    }

    private convertToClaudeFormat(messages: ContentBlock[]): Anthropic.MessageParam[] {
        return messages
            .filter(msg => msg.type === ContentType.TEXT)
            .map(msg => {
                const role = msg.data?.role;
                const content = msg.data?.content || "";
                
                // Claude поддерживает только user, assistant, и system роли
                const claudeRole = role === "system" ? "system" : 
                                 role === "assistant" ? "assistant" : "user";
                
                return {
                    role: claudeRole as "user" | "assistant" | "system",
                    content
                };
            });
    }
}