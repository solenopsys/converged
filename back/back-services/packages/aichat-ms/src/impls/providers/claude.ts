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
    ContentType,
    Tool
} from "../../types";
import { StreamEventType } from "../../types";

// Обработчик текстовых дельт
class ClaudeTextDeltaHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "content_block_delta";
    }
    
    // Метод для получения текущей истории разговора
    getConversationHistory(): Anthropic.MessageParam[] {
        return [...this.conversationHistory];
    }
    
    // Метод для очистки истории разговора
    clearHistory(): void {
        this.conversationHistory = [];
        console.log(`[ClaudeConversation] История разговора очищена`);
    }
    
    // Метод для установки начальной истории (если нужно восстановить из БД)
    setConversationHistory(history: Anthropic.MessageParam[]): void {
        this.conversationHistory = [...history];
        console.log(`[ClaudeConversation] Установлена история разговора: ${this.conversationHistory.length} сообщений`);
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
                args: event.content_block.input || {},
                tokens: totalTokens
            };
        }
        
        return null;
    }
}

// Обработчик вызовов функций - дельты для аргументов
class ClaudeToolCallHandler extends EventHandler {
    private currentArgs: Map<string, string> = new Map();
    
    canHandle(eventType: string): boolean {
        return eventType === "content_block_delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        // Дельта для input параметров tool use
        if (event.delta?.type === "input_json_delta") {
            const blockIndex = event.index?.toString() || "0";
            
            // Накапливаем частичный JSON
            const currentPartial = this.currentArgs.get(blockIndex) || "";
            const newPartial = currentPartial + (event.delta.partial_json || "");
            this.currentArgs.set(blockIndex, newPartial);
            
            console.log(`[ClaudeToolCallHandler] Обрабатываю дельту аргументов функции, блок ${blockIndex}`);
            console.log(`[ClaudeToolCallHandler] Накопленный JSON:`, newPartial);
            
            // Пытаемся парсить JSON если он завершен
            let parsedArgs = {};
            try {
                // Проверяем, является ли JSON завершенным
                if (newPartial.trim() && (newPartial.trim().endsWith('}') || newPartial.trim().endsWith(']'))) {
                    parsedArgs = JSON.parse(newPartial);
                    console.log(`[ClaudeToolCallHandler] Успешно распарсил аргументы:`, parsedArgs);
                } else {
                    // Если JSON не завершен, отправляем как есть
                    parsedArgs = { _partial: newPartial };
                }
            } catch (e) {
                // Если не удается парсить, сохраняем как partial
                parsedArgs = { _partial: newPartial };
                console.log(`[ClaudeToolCallHandler] JSON еще не завершен, сохраняю как partial`);
            }
            
            return {
                type: StreamEventType.TOOL_CALL,
                id: blockIndex,
                name: "",
                args: parsedArgs,
                tokens: totalTokens
            };
        }
        
        return null;
    }
}

// Обработчик завершения блока контента
class ClaudeContentStopHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "content_block_stop";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        console.log(`[ClaudeContentStopHandler] Завершен блок контента, индекс: ${event.index}, токенов: ${totalTokens}`);
        // Очищаем накопленные аргументы для этого блока если это tool call handler
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
    private conversationHistory: Anthropic.MessageParam[] = []; // Добавляем историю разговора
    private handlers: EventHandler[] = [
        new ClaudeTextDeltaHandler(),       // Основной обработчик текстовых дельт
        new ClaudeContentStartHandler(),    // Обработчик начала контента
        new ClaudeToolCallHandler(),        // Обработчик вызовов функций
        new ClaudeContentStopHandler(),     // Обработчик завершения блока контента
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
    
    // Преобразование Tool в формат Claude
    private convertToolToClaudeFormat(tool: Tool): Anthropic.Tool {
        console.log(`[ClaudeConversation] Преобразую инструмент: ${tool.name}`);
        console.log(`[ClaudeConversation] Оригинальные параметры:`, JSON.stringify(tool.parameters, null, 2));
        
        // Claude требует точную структуру input_schema с обязательными полями
        let inputSchema = tool.parameters;
        
        // Если parameters отсутствует или некорректен, создаем минимальную схему
        if (!inputSchema || typeof inputSchema !== 'object') {
            inputSchema = {
                type: "object",
                properties: {},
                required: []
            };
        }
        
        // Убеждаемся, что есть обязательные поля
        if (!inputSchema.type) {
            inputSchema.type = "object";
        }
        
        if (!inputSchema.properties) {
            inputSchema.properties = {};
        }
        
        if (!inputSchema.required) {
            inputSchema.required = [];
        }
        
        const claudeTool: Anthropic.Tool = {
            name: tool.name,
            description: tool.description,
            input_schema: inputSchema
        };
        
        console.log(`[ClaudeConversation] Преобразованный инструмент:`, JSON.stringify(claudeTool, null, 2));
        return claudeTool;
    }
    
    async* send(
        messages: ContentBlock[],
        options?: ConversationOptions
    ): AsyncIterable<StreamEvent> {
        console.log(`[ClaudeConversation] Начинаю отправку ${messages.length} сообщений`);
        console.log(`[ClaudeConversation] Опции:`, JSON.stringify(options, null, 2));
        
        if (options?.tools) {
            console.log(`[ClaudeConversation] Доступные инструменты: ${options.tools.map(t => t.name).join(', ')}`);
            options.tools.forEach((tool, index) => {
                console.log(`[ClaudeConversation] Инструмент ${index + 1}:`, JSON.stringify(tool, null, 2));
            });
        }
        
        try {
            // Логируем входящие сообщения пользователя
            console.log(`[ClaudeConversation] Логирую ${messages.length} входящих сообщений`);
            await Promise.all(
                messages.map(async (msg, index) => {
                    console.log(`[ClaudeConversation] Логирую сообщение ${index + 1}/${messages.length} от пользователя`);
                    return this.log(msg, MessageSource.USER);
                })
            );

            // Преобразуем новые сообщения в формат Claude
            const newClaudeMessages = this.convertToClaudeFormat(messages);
            console.log(`[ClaudeConversation] Преобразовано ${newClaudeMessages.length} новых сообщений`);
            
            // Добавляем новые сообщения к истории разговора
            this.conversationHistory.push(...newClaudeMessages);
            console.log(`[ClaudeConversation] Общая история: ${this.conversationHistory.length} сообщений`);
            
            // Валидация: проверяем, что tool_result имеет соответствующий tool_use
            this.validateToolContext(this.conversationHistory);
            
            // Извлекаем system сообщение если есть
            const systemMessages = this.conversationHistory.filter(msg => msg.role === "system");
            const conversationMessages = this.conversationHistory.filter(msg => msg.role !== "system");
            const systemMessage = systemMessages.length > 0 ? systemMessages[0].content as string : undefined;

            console.log(`[ClaudeConversation] System сообщений: ${systemMessages.length}, обычных сообщений: ${conversationMessages.length}`);

            // Подготавливаем параметры запроса
            const requestParams: any = {
                model: this.model,
                max_tokens: options?.maxTokens || 4096,
                messages: conversationMessages,
                stream: true,
                temperature: options?.temperature,
                top_p: options?.top_p,
                top_k: options?.top_k
            };

            // Добавляем system сообщение если есть
            if (systemMessage) {
                requestParams.system = systemMessage;
            }

            // Добавляем инструменты если они есть (формат для Claude)
            if (options?.tools && options.tools.length > 0) {
                console.log(`[ClaudeConversation] Начинаю преобразование ${options.tools.length} инструментов`);
                
                const convertedTools = options.tools.map((tool, index) => {
                    console.log(`[ClaudeConversation] Обрабатываю инструмент ${index + 1}: ${tool.name}`);
                    const converted = this.convertToolToClaudeFormat(tool);
                    
                    // Дополнительная валидация
                    if (!converted.input_schema) {
                        console.error(`[ClaudeConversation] ОШИБКА: отсутствует input_schema для инструмента ${tool.name}`);
                        throw new Error(`Missing input_schema for tool ${tool.name}`);
                    }
                    
                    if (!converted.input_schema.type) {
                        console.error(`[ClaudeConversation] ОШИБКА: отсутствует type в input_schema для инструмента ${tool.name}`);
                        converted.input_schema.type = "object";
                    }
                    
                    return converted;
                });
                
                requestParams.tools = convertedTools;
                console.log(`[ClaudeConversation] Добавлено ${requestParams.tools.length} инструментов`);
                console.log(`[ClaudeConversation] Финальные инструменты:`, JSON.stringify(requestParams.tools, null, 2));
            }

            // Создаем стрим через Claude Messages API
            console.log(`[ClaudeConversation] Создаю стрим через Claude Messages API...`);
            console.log(`[ClaudeConversation] Параметры запроса:`, JSON.stringify({
                ...requestParams,
                // Скрываем потенциально длинные массивы для лучшей читаемости
                messages: `[${requestParams.messages?.length || 0} messages]`,
                tools: requestParams.tools ? `[${requestParams.tools.length} tools]` : undefined
            }, null, 2));
            
            const stream = await this.anthropic.messages.create(requestParams);

            console.log(`[ClaudeConversation] Стрим создан успешно, начинаю обработку событий`);

            let totalTokens = 0;
            let eventCount = 0;
            let assistantMessage: Anthropic.MessageParam | null = null;
            let currentContent: any[] = [];

            // Обрабатываем события от Claude
            for await (const event of stream) {
                eventCount++;
                const claudeEvent = event as any;
                const eventType = claudeEvent.type;

                console.log(`[ClaudeConversation] Событие ${eventCount}: тип="${eventType}"`);

                // Собираем контент ассистента для истории
                if (eventType === "content_block_start") {
                    if (claudeEvent.content_block?.type === "text") {
                        currentContent.push({
                            type: "text",
                            text: claudeEvent.content_block.text || ""
                        });
                    } else if (claudeEvent.content_block?.type === "tool_use") {
                        currentContent.push({
                            type: "tool_use",
                            id: claudeEvent.content_block.id,
                            name: claudeEvent.content_block.name,
                            input: claudeEvent.content_block.input || {}
                        });
                    }
                }

                // Обновляем текстовый контент
                if (eventType === "content_block_delta" && claudeEvent.delta?.type === "text_delta") {
                    const lastContent = currentContent[currentContent.length - 1];
                    if (lastContent && lastContent.type === "text") {
                        lastContent.text += claudeEvent.delta.text;
                    }
                }

                // Обновляем input для tool_use
                if (eventType === "content_block_delta" && claudeEvent.delta?.type === "input_json_delta") {
                    const lastContent = currentContent[currentContent.length - 1];
                    if (lastContent && lastContent.type === "tool_use") {
                        const currentPartial = lastContent._partialInput || "";
                        const newPartial = currentPartial + claudeEvent.delta.partial_json;
                        lastContent._partialInput = newPartial;
                        
                        // Пытаемся парсить завершенный JSON
                        try {
                            if (newPartial.trim().endsWith('}') || newPartial.trim().endsWith(']')) {
                                lastContent.input = JSON.parse(newPartial);
                                delete lastContent._partialInput;
                            }
                        } catch (e) {
                            // JSON еще не завершен
                        }
                    }
                }

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
                            
                            // Сохраняем ответ ассистента в историю (только если не ошибка)
                            if (result.type === StreamEventType.COMPLETED && currentContent.length > 0) {
                                assistantMessage = {
                                    role: "assistant",
                                    content: currentContent.length === 1 && currentContent[0].type === "text" 
                                        ? currentContent[0].text 
                                        : currentContent
                                };
                                this.conversationHistory.push(assistantMessage);
                                console.log(`[ClaudeConversation] Добавлен ответ ассистента в историю. Всего сообщений: ${this.conversationHistory.length}`);
                            }
                            
                            console.log(`[ClaudeConversation] Завершаю обработку стрима. Обработано событий: ${eventCount}`);
                            return;
                        }
                        
                        // КРИТИЧНО: Если это tool_call - немедленно сохраняем частичный ответ ассистента
                        if (result.type === StreamEventType.TOOL_CALL && currentContent.length > 0) {
                            // Проверяем, есть ли уже tool_use в текущем контенте
                            const hasToolUse = currentContent.some(block => block.type === "tool_use");
                            if (hasToolUse) {
                                assistantMessage = {
                                    role: "assistant",
                                    content: currentContent.length === 1 && currentContent[0].type === "text" 
                                        ? currentContent[0].text 
                                        : currentContent
                                };
                                this.conversationHistory.push(assistantMessage);
                                console.log(`[ClaudeConversation] Немедленно добавлен ответ ассистента с tool_use в историю. Всего сообщений: ${this.conversationHistory.length}`);
                                
                                // Очищаем currentContent чтобы не дублировать при завершении
                                currentContent = [];
                            }
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

    // Добавляем метод валидации контекста tool
    private validateToolContext(messages: Anthropic.MessageParam[]): void {
        console.log(`[ClaudeConversation] Валидирую контекст инструментов для ${messages.length} сообщений`);
        
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            const content = Array.isArray(message.content) ? message.content : [message.content];
            
            for (const block of content) {
                if (typeof block === 'object' && block.type === 'tool_result') {
                    console.log(`[ClaudeConversation] Найден tool_result с ID: ${block.tool_use_id}`);
                    
                    // Ищем соответствующий tool_use в предыдущих сообщениях
                    let foundToolUse = false;
                    for (let j = i - 1; j >= 0; j--) {
                        const prevMessage = messages[j];
                        const prevContent = Array.isArray(prevMessage.content) ? prevMessage.content : [prevMessage.content];
                        
                        for (const prevBlock of prevContent) {
                            if (typeof prevBlock === 'object' && 
                                prevBlock.type === 'tool_use' && 
                                prevBlock.id === block.tool_use_id) {
                                foundToolUse = true;
                                console.log(`[ClaudeConversation] Найден соответствующий tool_use для ID: ${block.tool_use_id}`);
                                break;
                            }
                        }
                        if (foundToolUse) break;
                    }
                    
                    if (!foundToolUse) {
                        const errorMsg = `Tool result with ID ${block.tool_use_id} has no corresponding tool_use in conversation history`;
                        console.error(`[ClaudeConversation] ОШИБКА: ${errorMsg}`);
                        throw new Error(errorMsg);
                    }
                }
            }
        }
        
        console.log(`[ClaudeConversation] Валидация контекста инструментов пройдена успешно`);
    }

    private convertToClaudeFormat(messages: ContentBlock[]): Anthropic.MessageParam[] {
        console.log(`[ClaudeConversation] Начинаю преобразование ${messages.length} сообщений`);
        
        return messages
            .filter(msg => {
                // Принимаем TEXT и TOOL_RESULT типы сообщений
                const isValidType = msg.type === ContentType.TEXT || msg.type === "tool_result";
                console.log(`[ClaudeConversation] Сообщение тип: ${msg.type}, проходит фильтр: ${isValidType}`);
                return isValidType;
            })
            .map((msg, index) => {
                let role = "user";
                let content: string | Anthropic.MessageParam['content'] = "";
                
                // Обработка tool_result сообщений
                if (msg.type === "tool_result") {
                    console.log(`[ClaudeConversation] Обрабатываю tool_result сообщение ${index + 1}`);
                    const toolResultData = msg.data as any;
                    
                    content = [
                        {
                            type: "tool_result",
                            tool_use_id: toolResultData.tool_call_id || msg.tool_call_id,
                            content: typeof toolResultData.data === 'string' 
                                ? toolResultData.data 
                                : JSON.stringify(toolResultData.data || toolResultData)
                        }
                    ];
                    
                    console.log(`[ClaudeConversation] Tool result - ID: ${toolResultData.tool_call_id}, содержимое: ${content[0].content}`);
                    
                    return {
                        role: "user" as const,
                        content
                    };
                }
                
                // Обработка обычных сообщений
                if (typeof msg.data === "string") {
                    // Если data - это строка, то это контент от пользователя
                    content = msg.data;
                    console.log(`[ClaudeConversation] Сообщение ${index + 1}: строка, длина ${content.length}`);
                } else if (typeof msg.data === "object" && msg.data !== null) {
                    // Если data - это объект, извлекаем роль и контент
                    const msgData = msg.data as any;
                    role = msgData.role || "user";
                    
                    // Проверяем, есть ли tool_calls или tool результаты
                    if (msgData.tool_calls) {
                        // Это сообщение ассистента с вызовами функций
                        content = msgData.tool_calls.map((toolCall: any) => ({
                            type: "tool_use",
                            id: toolCall.id,
                            name: toolCall.function?.name || toolCall.name,
                            input: typeof toolCall.function?.arguments === 'string' 
                                ? JSON.parse(toolCall.function.arguments)
                                : toolCall.function?.arguments || toolCall.args || {}
                        }));
                        
                        // Добавляем текстовый контент если есть
                        if (msgData.content && typeof msgData.content === 'string') {
                            content = [
                                { type: "text", text: msgData.content },
                                ...content
                            ];
                        }
                    } else if (msgData.tool_call_id) {
                        // Это результат выполнения функции
                        content = [
                            {
                                type: "tool_result",
                                tool_use_id: msgData.tool_call_id,
                                content: msgData.content || ""
                            }
                        ];
                    } else {
                        // Обычное сообщение
                        content = msgData.content || "";
                    }
                    
                    console.log(`[ClaudeConversation] Сообщение ${index + 1}: объект, роль="${role}", тип контента=${typeof content}`);
                }
                
                // Claude поддерживает только user, assistant, и system роли
                const claudeRole = role === "system" ? "system" : 
                                 role === "assistant" ? "assistant" : "user";
                
                console.log(`[ClaudeConversation] Преобразованная роль: "${role}" → "${claudeRole}"`);
                
                return {
                    role: claudeRole as "user" | "assistant" | "system",
                    content
                };
            });
    }
}