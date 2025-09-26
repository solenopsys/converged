import OpenAI from "openai";
import { randomUUID } from "crypto";
 
import { StreamEvent, EventHandler,AiConversation, MessageSource, LogFunction, ConversationOptions,ContentBlock, ContentType, } from "../../types";
import { StreamEventType } from "../../types";
 

// Обработчик текстовых дельт (исправленный)
class TextDeltaHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.output_text.delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent {
        console.log(`[TextDeltaHandler] Обрабатываю текстовую дельту: "${event.delta || ""}", токенов: ${totalTokens}`);
        return {
            type: StreamEventType.TEXT_DELTA,
            content: event.delta || "",
            tokens: totalTokens
        };
    }
}

// Обработчик начала текстового контента
class TextStartHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.content_part.added";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        // Обрабатываем только текстовые части
        if (event.part?.type === "output_text") {
            console.log(`[TextStartHandler] Начат новый текстовый блок, токенов: ${totalTokens}`);
            return {
                type: StreamEventType.TEXT_DELTA,
                content: event.part?.text || "",
                tokens: totalTokens
            };
        }
        return null;
    }
}

// Обработчик завершения текстового контента
class TextDoneHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.output_text.done";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        console.log(`[TextDoneHandler] Завершен текстовый блок: "${event.text || ""}", токенов: ${totalTokens}`);
        // Можем отправить финальный текст или просто проигнорировать, 
        // так как дельты уже были отправлены
        return null;
    }
}

// Обработчик начала ответа
class ResponseStartHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.in_progress";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        console.log(`[ResponseStartHandler] Начат ответ ассистента, токенов: ${totalTokens}`);
        // Просто логируем, не отправляем событие клиенту
        return null;
    }
}

// Обработчик добавления элементов вывода
class OutputItemHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.output_item.added" || 
               eventType === "response.output_item.done";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        console.log(`[OutputItemHandler] Обработка элемента вывода: ${event.type}, токенов: ${totalTokens}`);
        // Просто логируем, не отправляем событие клиенту
        return null;
    }
}

// Обработчик частей контента
class ContentPartHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.content_part.done";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        console.log(`[ContentPartHandler] Завершена часть контента, токенов: ${totalTokens}`);
        // Просто логируем, не отправляем событие клиенту
        return null;
    }
}

// Обработчик вызовов функций
class ToolCallHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.function_call_delta" || 
               eventType === "response.tool_calls.delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        if (!event.delta?.name && !event.delta?.arguments) {
            console.log(`[ToolCallHandler] Пропускаю событие - нет имени функции или аргументов`);
            return null;
        }
        
        console.log(`[ToolCallHandler] Обрабатываю вызов функции: ${event.delta?.name || "unknown"}, токенов: ${totalTokens}`);
        console.log(`[ToolCallHandler] Аргументы:`, event.delta?.arguments);
        
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
        const finishReason = event.response?.status || "completed";
        console.log(`[CompletionHandler] Завершаю обработку. Причина: ${finishReason}, токенов: ${totalTokens}`);
        
        return {
            type: StreamEventType.COMPLETED,
            finishReason,
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
        const errorMessage = event.error?.message || "Unknown error";
        console.error(`[ErrorHandler] Обрабатываю ошибку: ${errorMessage}, токенов: ${totalTokens}`);
        
        return {
            type: StreamEventType.ERROR,
            message: errorMessage,
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
        new TextDeltaHandler(),           // Основной обработчик текстовых дельт
        new TextStartHandler(),           // Обработчик начала текста
        new TextDoneHandler(),            // Обработчик завершения текста
        new ResponseStartHandler(),       // Обработчик начала ответа
        new OutputItemHandler(),          // Обработчик элементов вывода
        new ContentPartHandler(),         // Обработчик частей контента
        new ToolCallHandler(),            // Обработчик вызовов функций
        new CompletionHandler(),          // Обработчик завершения
        new ErrorHandler()                // Обработчик ошибок
    ];
    
    constructor(model: string, apiKey: string, log: LogFunction) {
        this.id = randomUUID();
        this.model = model;
        this.openai = new OpenAI({ apiKey });
        this.log = log;
        
        console.log(`[OpenAIConversation] Создан новый разговор. ID: ${this.id}, модель: ${this.model}`);
        console.log(`[OpenAIConversation] Зарегистрировано ${this.handlers.length} обработчиков событий:`);
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
        console.log(`[OpenAIConversation] Начинаю отправку ${messages.length} сообщений`);
        console.log(`[OpenAIConversation] Опции:`, options);
        
        try {
            // Логируем входящие сообщения пользователя
            console.log(`[OpenAIConversation] Логирую ${messages.length} входящих сообщений`);
            await Promise.all(
                messages.map(async (msg, index) => {
                    console.log(`[OpenAIConversation] Логирую сообщение ${index + 1}/${messages.length} от пользователя`);
                    return this.log(msg, MessageSource.USER);
                })
            );

            // Преобразуем ContentBlock[] в формат OpenAI
            const input = messages
                .filter(msg => {
                    const isText = msg.type === ContentType.TEXT;
                    if (!isText) {
                        console.log(`[OpenAIConversation] Пропускаю сообщение типа: ${msg.type}`);
                    }
                    return isText;
                })
                .map((msg, index) => {
                    // Определяем роль и контент в зависимости от структуры данных
                    let role = "user";
                    let content = "";
                    
                    if (typeof msg.data === "string") {
                        // Если data - это строка, то это контент от пользователя
                        content = msg.data;
                    } else if (typeof msg.data === "object" && msg.data !== null) {
                        // Если data - это объект, извлекаем роль и контент
                        role = msg.data.role || "user";
                        content = msg.data.content || "";
                    }
                    
                    console.log(`[OpenAIConversation] Преобразую сообщение ${index + 1}: роль="${role}", длина контента=${content.length} символов`);
                    console.log(`[OpenAIConversation] Контент: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
                    
                    return {
                        role,
                        content
                    };
                });

            console.log(`[OpenAIConversation] Подготовлено ${input.length} сообщений для OpenAI API`);

            // Создаем стрим через OpenAI Responses API
            console.log(`[OpenAIConversation] Создаю стрим через OpenAI Responses API...`);
            const stream = await this.openai.responses.create({
                model: this.model,
                input,
                stream: true,
                ...options
            });

            console.log(`[OpenAIConversation] Стрим создан успешно, начинаю обработку событий`);

            let totalTokens = 0;
            let eventCount = 0;

            // Обрабатываем события от OpenAI
            // @ts-ignore
            for await (const event of stream) {
                eventCount++;
                const openaiEvent = event as any;
                const eventType = openaiEvent.type;

                console.log(`[OpenAIConversation] Событие ${eventCount}: тип="${eventType}"`);

                // Извлекаем токены если есть (обновлено для новой структуры)
                const tokens = openaiEvent.usage?.total_tokens 
                    || openaiEvent.response?.usage?.total_tokens 
                    || 0;
                
                if (tokens && tokens !== totalTokens) {
                    console.log(`[OpenAIConversation] Обновляю счетчик токенов: ${totalTokens} → ${tokens}`);
                    totalTokens = tokens;
                }

                // Логируем все события от ассистента
                console.log(`[OpenAIConversation] Логирую событие от ассистента`);
                await this.log(openaiEvent, MessageSource.ASSISTANT);

                // Ищем подходящий хендлер
                const handler = this.handlers.find(h => h.canHandle(eventType));
                if (handler) {
                    console.log(`[OpenAIConversation] Найден обработчик для события "${eventType}": ${handler.constructor.name}`);
                    const result = handler.handle(openaiEvent, totalTokens);
                    if (result) {
                        console.log(`[OpenAIConversation] Обработчик вернул результат типа: ${result.type}`);
                        yield result;
                        
                        // Завершаем если это completion или error
                        if (result.type === StreamEventType.COMPLETED || 
                            result.type === StreamEventType.ERROR) {
                            console.log(`[OpenAIConversation] Завершаю обработку стрима. Обработано событий: ${eventCount}`);
                            return;
                        }
                    } else {
                        console.log(`[OpenAIConversation] Обработчик не вернул результат (null)`);
                    }
                } else {
                    console.warn(`[OpenAIConversation] Не найден обработчик для события типа "${eventType}"`);
                }
            }

            console.log(`[OpenAIConversation] Стрим завершен. Всего обработано событий: ${eventCount}`);

        } catch (error: any) {
            console.error(`[OpenAIConversation] Произошла ошибка:`, error);
            console.error(`[OpenAIConversation] Стек ошибки:`, error.stack);
            
            // Логируем ошибку
            await this.log({ error: error.message }, MessageSource.ASSISTANT);
            
            yield {
                type: StreamEventType.ERROR,
                message: error?.message || "Request failed",
                tokens: 0
            };
        }
    }
}