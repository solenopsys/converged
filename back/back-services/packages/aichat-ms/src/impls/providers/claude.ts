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
        return eventType === "content_block_delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        // Проверяем, что это текстовая дельта
        if (event?.delta?.type === "text_delta") {
            const textContent = event.delta?.text || "";
            console.log(`[ClaudeTextDeltaHandler] Обрабатываю текстовую дельту: "${textContent}", токенов: ${totalTokens}`);
            return {
                type: StreamEventType.TEXT_DELTA,
                content: textContent,
                tokens: totalTokens
            };
        }
        return null;
    }
}

// Обработчик начала контента
class ClaudeContentStartHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "content_block_start";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        // Обрабатываем начало текстового блока
        if (event.content_block?.type === "text") {
            console.log(`[ClaudeContentStartHandler] Начат новый текстовый блок, токенов: ${totalTokens}`);
            return {
                type: StreamEventType.TEXT_DELTA,
                content: event.content_block?.text || "",
                tokens: totalTokens
            };
        }
        
        // Обрабатываем начало tool use блока
        if (event.content_block?.type === "tool_use") {
            console.log(`[ClaudeContentStartHandler] Начат блок вызова функции: ${event.content_block.name}, токенов: ${totalTokens}`);
            return {
                type: StreamEventType.TOOL_CALL,
                id: event.content_block.id,
                name: event.content_block.name,
                args: {},
                tokens: totalTokens
            };
        }
        
        return null;
    }
}

// Обработчик вызовов функций
class ClaudeToolCallHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "content_block_delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        // Дельта для input параметров tool use
        if (event.delta?.type === "input_json_delta") {
            console.log(`[ClaudeToolCallHandler] Обрабатываю дельту аргументов функции, токенов: ${totalTokens}`);
            console.log(`[ClaudeToolCallHandler] Частичный JSON:`, event.delta.partial_json);
            
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

// Обработчик начала сообщения
class ClaudeMessageStartHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "message_start";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        console.log(`[ClaudeMessageStartHandler] Начато сообщение от ассистента, токенов: ${totalTokens}`);
        // Просто логируем, не отправляем событие клиенту
        return null;
    }
}

// Обработчик дельты сообщения
class ClaudeMessageDeltaHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "message_delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        console.log(`[ClaudeMessageDeltaHandler] Дельта сообщения, токенов: ${totalTokens}`);
        // Просто логируем, не отправляем событие клиенту
        return null;
    }
}

// Обработчик завершения
class ClaudeCompletionHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "message_stop";
    }
    
    handle(event: any, totalTokens: number): StreamEvent {
        console.log(`[ClaudeCompletionHandler] Завершаю обработку. Токенов: ${totalTokens}`);
        
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
        const errorMessage = event.error?.message || "Unknown error";
        console.error(`[ClaudeErrorHandler] Обрабатываю ошибку: ${errorMessage}, токенов: ${totalTokens}`);
        
        return {
            type: StreamEventType.ERROR,
            message: errorMessage,
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
        new ClaudeTextDeltaHandler(),       // Основной обработчик текстовых дельт
        new ClaudeContentStartHandler(),    // Обработчик начала контента
        new ClaudeToolCallHandler(),        // Обработчик вызовов функций
        new ClaudeMessageStartHandler(),    // Обработчик начала сообщения
        new ClaudeMessageDeltaHandler(),    // Обработчик дельты сообщения
        new ClaudeCompletionHandler(),      // Обработчик завершения
        new ClaudeErrorHandler()            // Обработчик ошибок
    ];
    
    constructor(model: string, apiKey: string, log: LogFunction) {
        this.id = randomUUID();
        this.model = model;
        this.anthropic = new Anthropic({ apiKey });
        this.log = log;
        
        console.log(`[ClaudeConversation] Создан новый разговор. ID: ${this.id}, модель: ${this.model}`);
        console.log(`[ClaudeConversation] Зарегистрировано ${this.handlers.length} обработчиков событий:`);
        this.handlers.forEach((handler, index) => {
            console.log(`  ${index + 1}. ${handler.constructor.name}`);
        });
    }
    
    getId(): string {
        return this.id;
    }
    
    async* send(
        messages: ContentBlock[],
        options?: ConversationOptions
    ): AsyncIterable<StreamEvent> {
        console.log(`[ClaudeConversation] Начинаю отправку ${messages.length} сообщений`);
        console.log(`[ClaudeConversation] Опции:`, options);
        
        try {
            // Логируем входящие сообщения пользователя
            console.log(`[ClaudeConversation] Логирую ${messages.length} входящих сообщений`);
            await Promise.all(
                messages.map(async (msg, index) => {
                    console.log(`[ClaudeConversation] Логирую сообщение ${index + 1}/${messages.length} от пользователя`);
                    return this.log(msg, MessageSource.USER);
                })
            );

            // Преобразуем ContentBlock[] в формат Claude
            const claudeMessages = this.convertToClaudeFormat(messages);
            console.log(`[ClaudeConversation] Преобразовано ${claudeMessages.length} сообщений для Claude API`);
            
            // Извлекаем system сообщение если есть
            const systemMessages = claudeMessages.filter(msg => msg.role === "system");
            const conversationMessages = claudeMessages.filter(msg => msg.role !== "system");
            const systemMessage = systemMessages.length > 0 ? systemMessages[0].content as string : undefined;

            console.log(`[ClaudeConversation] System сообщений: ${systemMessages.length}, обычных сообщений: ${conversationMessages.length}`);

            // Создаем стрим через Claude Messages API
            console.log(`[ClaudeConversation] Создаю стрим через Claude Messages API...`);
            const stream = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: options?.maxTokens || 4096,
                messages: conversationMessages,
                system: systemMessage,
                stream: true,
                tools: options?.tools,
                temperature: options?.temperature,
                top_p: options?.top_p,
                top_k: options?.top_k,
                ...options
            });

            console.log(`[ClaudeConversation] Стрим создан успешно, начинаю обработку событий`);

            let totalTokens = 0;
            let eventCount = 0;

            // Обрабатываем события от Claude
            for await (const event of stream) {
                eventCount++;
                const claudeEvent = event as any;
                const eventType = claudeEvent.type;

                console.log(`[ClaudeConversation] Событие ${eventCount}: тип="${eventType}"`);

                // Извлекаем токены из usage если есть
                if (claudeEvent.usage) {
                    const newTotal = (claudeEvent.usage.input_tokens || 0) + 
                                   (claudeEvent.usage.output_tokens || 0);
                    if (newTotal && newTotal !== totalTokens) {
                        console.log(`[ClaudeConversation] Обновляю счетчик токенов: ${totalTokens} → ${newTotal}`);
                        totalTokens = newTotal;
                    }
                }

                // Логируем все события от ассистента
                console.log(`[ClaudeConversation] Логирую событие от ассистента`);
                await this.log(claudeEvent, MessageSource.ASSISTANT);

                // Ищем подходящий хендлер
                const handler = this.handlers.find(h => h.canHandle(eventType));
                if (handler) {
                    console.log(`[ClaudeConversation] Найден обработчик для события "${eventType}": ${handler.constructor.name}`);
                    const result = handler.handle(claudeEvent, totalTokens);
                    if (result) {
                        console.log(`[ClaudeConversation] Обработчик вернул результат типа: ${result.type}`);
                        yield result;
                        
                        // Завершаем если это completion или error
                        if (result.type === StreamEventType.COMPLETED || 
                            result.type === StreamEventType.ERROR) {
                            console.log(`[ClaudeConversation] Завершаю обработку стрима. Обработано событий: ${eventCount}`);
                            return;
                        }
                    } else {
                        console.log(`[ClaudeConversation] Обработчик не вернул результат (null)`);
                    }
                } else {
                    console.warn(`[ClaudeConversation] Не найден обработчик для события типа "${eventType}"`);
                }
            }

            console.log(`[ClaudeConversation] Стрим завершен. Всего обработано событий: ${eventCount}`);

        } catch (error: any) {
            console.error(`[ClaudeConversation] Произошла ошибка:`, error);
            console.error(`[ClaudeConversation] Стек ошибки:`, error.stack);
            
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
        console.log(`[ClaudeConversation] Начинаю преобразование ${messages.length} сообщений`);
        
        return messages
            .filter(msg => {
                const isText = msg.type === ContentType.TEXT;
                console.log(`[ClaudeConversation] Сообщение тип: ${msg.type}, проходит фильтр: ${isText}`);
                return isText;
            })
            .map((msg, index) => {
                let role = "user";
                let content = "";
                
                if (typeof msg.data === "string") {
                    // Если data - это строка, то это контент от пользователя
                    content = msg.data;
                    console.log(`[ClaudeConversation] Сообщение ${index + 1}: строка, длина ${content.length}`);
                } else if (typeof msg.data === "object" && msg.data !== null) {
                    // Если data - это объект, извлекаем роль и контент
                    role = (msg.data as any).role || "user";
                    content = (msg.data as any).content || "";
                    console.log(`[ClaudeConversation] Сообщение ${index + 1}: объект, роль="${role}", длина контента=${content.length}`);
                }
                
                // Claude поддерживает только user, assistant, и system роли
                const claudeRole = role === "system" ? "system" : 
                                 role === "assistant" ? "assistant" : "user";
                
                console.log(`[ClaudeConversation] Преобразованная роль: "${role}" → "${claudeRole}"`);
                console.log(`[ClaudeConversation] Контент: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
                
                return {
                    role: claudeRole as "user" | "assistant" | "system",
                    content
                };
            });
    }
}