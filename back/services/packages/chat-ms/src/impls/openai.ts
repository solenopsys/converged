import OpenAI from "openai";
import { randomUUID } from "crypto";
 
import { StreamEvent, EventHandler,AiConversation, MessageType, LogFunction, ConversationOptions,ContentBlock, ContentType, } from "../types";
import { StreamEventType } from "../types";
 

// Обработчик текстовых дельт
class TextDeltaHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.text.delta";
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
class ToolCallHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.function_call_delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        if (!event.delta?.name && !event.delta?.arguments) {
            return null;
        }
        
        return {
            type: StreamEventType.TOOL_CALL,
            id: event.id || randomUUID(),
            name: event.delta?.name || "",
            args: event.delta?.arguments || {},
            tokens: totalTokens
        };
    }
}

// Обработчик завершения
class CompletionHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.completed" || eventType === "done";
    }
    
    handle(event: any, totalTokens: number): StreamEvent {
        return {
            type: StreamEventType.COMPLETED,
            finishReason: event.response?.status || "completed",
            tokens: totalTokens
        };
    }
}

// Обработчик ошибок
class ErrorHandler extends EventHandler {
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

// Реализация для OpenAI
export class OpenAIConversation implements AiConversation {
    private id: string;
    private model: string;
    private openai: OpenAI;
    private log: LogFunction;
    private handlers: EventHandler[] = [
        new TextDeltaHandler(),
        new ToolCallHandler(),
        new CompletionHandler(),
        new ErrorHandler()
    ];
    
    constructor(model: string, apiKey: string, log: LogFunction) {
        this.id = randomUUID();
        this.model = model;
        this.openai = new OpenAI({ apiKey });
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
                messages.map(msg => this.log(msg, MessageType.USER))
            );

            // Преобразуем ContentBlock[] в формат OpenAI
            const input = messages
                .filter(msg => msg.type === ContentType.TEXT)
                .map(msg => ({
                    role: msg.data?.role || "user",
                    content: msg.data?.content || ""
                }));

            // Создаем стрим через OpenAI Responses API
            const stream = await this.openai.responses.create({
                model: this.model,
                input,
                stream: true,
                ...options
            });

            let totalTokens = 0;

            // Обрабатываем события от OpenAI
            for await (const event of stream) {
                const openaiEvent = event as any;
                const eventType = openaiEvent.type;

                // Извлекаем токены если есть
                const tokens = openaiEvent.usage?.total_tokens 
                    || openaiEvent.response?.usage?.total_tokens 
                    || 0;
                
                if (tokens) totalTokens = tokens;

                // Логируем все события от ассистента
                await this.log(openaiEvent, MessageType.ASSISTANT);

                // Ищем подходящий хендлер
                const handler = this.handlers.find(h => h.canHandle(eventType));
                if (handler) {
                    const result = handler.handle(openaiEvent, totalTokens);
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
            await this.log({ error: error.message }, MessageType.ASSISTANT);
            
            yield {
                type: StreamEventType.ERROR,
                message: error?.message || "Request failed",
                tokens: 0
            };
        }
    }
}



