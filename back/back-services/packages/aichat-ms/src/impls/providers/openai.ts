import OpenAI from "openai";
import { randomUUID } from "crypto";
 
import { StreamEvent, EventHandler, AiConversation, MessageSource, LogFunction, ConversationOptions, ContentBlock, ContentType, StreamEventType, Tool } from "../../types";

// Обработчик текстовых дельт
class TextDeltaHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "response.output_text.delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent {
        const textContent = event.delta || "";
        console.log(`[TextDeltaHandler] Обрабатываю текстовую дельту: "${textContent}", токенов: ${totalTokens}`);
        return {
            type: StreamEventType.TEXT_DELTA,
            content: textContent,
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
        return null;
    }
}

// Обработчик добавления элементов вывода (только для не-tool событий)
class OutputItemHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        // Не обрабатываем output_item события, пусть их обрабатывает ToolCallHandler
        return false;
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        console.log(`[OutputItemHandler] Обработка элемента вывода: ${event.type}, токенов: ${totalTokens}`);
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
        return null;
    }
}

 // Обновленный обработчик вызовов функций - отправляет только финальные события
class ToolCallHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        // Обрабатываем только финальные события, игнорируем delta
        return eventType === "response.output_item.added" ||
               eventType === "response.output_item.done";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        console.log(`[ToolCallHandler] Обрабатываю событие инструмента:`, event);
        
        // Обработка добавления нового элемента функции
        if (event.type === "response.output_item.added" && 
            event.item?.type === "function_call") {
            
            console.log(`[ToolCallHandler] Начат вызов функции: ${event.item.name}, токенов: ${totalTokens}`);
            
            return {
                type: StreamEventType.TOOL_CALL,
                id: event.item.call_id || event.item.id || randomUUID(),
                name: event.item.name || "",
                args: {}, // Аргументы будут в done событии
                tokens: totalTokens
            };
        }
        
        // Обработка завершения элемента функции - отправляем полную информацию
        if (event.type === "response.output_item.done" && 
            event.item?.type === "function_call") {
            
            let parsedArgs = {};
            if (event.item.arguments) {
                try {
                    parsedArgs = typeof event.item.arguments === 'string' 
                        ? JSON.parse(event.item.arguments) 
                        : event.item.arguments;
                } catch (e) {
                    console.warn(`[ToolCallHandler] Не удалось распарсить аргументы: ${event.item.arguments}`);
                    parsedArgs = { raw: event.item.arguments };
                }
            }
            
            console.log(`[ToolCallHandler] Завершен вызов функции: ${event.item.name} с аргументами:`, parsedArgs);
            
            // Отправляем финальное событие с полными аргументами
            return {
                type: StreamEventType.TOOL_CALL,
                id: event.item.call_id || event.item.id || randomUUID(),
                name: event.item.name || "",
                args: parsedArgs,
                tokens: totalTokens
            };
        }
        
        return null;
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

// Реализация для OpenAI с поддержкой инструментов
export class OpenAIConversation implements AiConversation {
    private id: string;
    private model: string;
    private openai: OpenAI;
    private log: LogFunction;
    private handlers: EventHandler[] = [
        new TextDeltaHandler(),
        new TextStartHandler(),
        new TextDoneHandler(),
        new ResponseStartHandler(),
        new ToolCallHandler(),           // ToolCallHandler должен быть ЗДЕСЬ
        new OutputItemHandler(),
        new ContentPartHandler(),
        new CompletionHandler(),
        new ErrorHandler()
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
    
    // Преобразование Tool в формат OpenAI Responses API (правильный формат)
    private convertToolToOpenAIFormat(tool: Tool): any {
        return {
            type: "function",
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        };
    }
    
    async* send(
        messages: ContentBlock[],
        options?: ConversationOptions
    ): AsyncIterable<StreamEvent> {
        console.log(`[OpenAIConversation] Начинаю отправку ${messages.length} сообщений`);
        console.log(`[OpenAIConversation] Опции:`, options);
        
        if (options?.tools) {
            console.log(`[OpenAIConversation] Доступные инструменты: ${options.tools.map(t => t.name).join(', ')}`);
        }
        
        try {
            // Логируем входящие сообщения пользователя
            console.log(`[OpenAIConversation] Логирую ${messages.length} входящих сообщений`);
            await Promise.all(
                messages.map(async (msg, index) => {
                    console.log(`[OpenAIConversation] Логирую сообщение ${index + 1}/${messages.length} от пользователя`);
                    return this.log(msg, MessageSource.USER);
                })
            );

            // Преобразуем ContentBlock[] в формат OpenAI Responses API
            const input = messages.map((msg, index) => {
                let role = "user";
                let content = "";
                let toolCallId: string | undefined;
                let name: string | undefined;
                
                if (typeof msg.data === "string") {
                    content = msg.data;
                } else if (typeof msg.data === "object" && msg.data !== null) {
                    role = msg.data.role || "user";
                    content = msg.data.content || "";
                    toolCallId = msg.data.tool_call_id;
                    name = msg.data.name;
                }
                
                console.log(`[OpenAIConversation] Преобразую сообщение ${index + 1}: роль="${role}", длина контента=${content.length} символов`);
                
                const message: any = { role, content };
                if (toolCallId) message.tool_call_id = toolCallId;
                if (name) message.name = name;
                
                return message;
            });

            console.log(`[OpenAIConversation] Подготовлено ${input.length} сообщений для OpenAI API`);

            // Подготавливаем параметры запроса
            const requestParams: any = {
                model: this.model,
                input,
                stream: true,
                temperature: options?.temperature,
                max_tokens: options?.maxTokens
            };

            // Добавляем инструменты если они есть (формат для Responses API)
            if (options?.tools && options.tools.length > 0) {
                requestParams.tools = options.tools.map(tool => this.convertToolToOpenAIFormat(tool));
                console.log(`[OpenAIConversation] Добавлено ${requestParams.tools.length} инструментов`);
                console.log(`[OpenAIConversation] Инструменты:`, JSON.stringify(requestParams.tools, null, 2));
            }

            // Создаем стрим через OpenAI Responses API
            console.log(`[OpenAIConversation] Создаю стрим через OpenAI Responses API...`);
            const stream = await this.openai.responses.create(requestParams);

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

                // Извлекаем токены из события
                const tokens = openaiEvent.response?.usage?.total_tokens || 0;
                
                if (tokens && tokens !== totalTokens) {
                    console.log(`[OpenAIConversation] Обновляю счетчик токенов: ${totalTokens} → ${tokens}`);
                    totalTokens = tokens;
                }

                // Логируем все события от ассистента
                console.log(`[OpenAIConversation] Логирую событие от ассистента`);
                await this.log(openaiEvent, MessageSource.ASSISTANT);

                // Ищем подходящий хендлер
                console.log(`[OpenAIConversation] Ищу обработчик для события "${eventType}"`);
                const handler = this.handlers.find(h => {
                    const canHandle = h.canHandle(eventType);
                    console.log(`[OpenAIConversation] ${h.constructor.name}.canHandle("${eventType}") = ${canHandle}`);
                    return canHandle;
                });
                
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