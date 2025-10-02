import Anthropic from "@anthropic-ai/sdk";
import { BaseConversation } from "../conversation";
import { EventHandler } from "../hendler";
import { 
    StreamEvent, 
    MessageSource, 
    LogFunction, 
    ConversationOptions, 
    ContentBlock, 
    ContentType,
    Tool,
    StreamEventType
} from "../../types";

// Обработчик текстовых дельт для Claude
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

// Обработчик начала контента для Claude
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

// Обработчик вызовов функций для Claude - дельты для аргументов
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

// Обработчик завершения блока контента для Claude
class ClaudeContentStopHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "content_block_stop";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        console.log(`[ClaudeContentStopHandler] Завершен блок контента, индекс: ${event.index}, токенов: ${totalTokens}`);
        return null;
    }
}

// Обработчик завершения для Claude
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

// Обработчик ошибок для Claude
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
export class ClaudeConversation extends BaseConversation {
    private anthropic: Anthropic;
    private currentContent: any[] = [];
    private assistantMessage: Anthropic.MessageParam | null = null;
    
    constructor(model: string, apiKey: string, log: LogFunction) {
        super(model, log);
        this.anthropic = new Anthropic({ apiKey });
    }
    
    protected initializeHandlers(): void {
        this.handlers = [
            new ClaudeTextDeltaHandler(this),
            new ClaudeContentStartHandler(this),
            new ClaudeToolCallHandler(this),
            new ClaudeContentStopHandler(this),
            new ClaudeCompletionHandler(this),
            new ClaudeErrorHandler(this)
        ];
    }
    
    protected getEventType(event: any): string {
        return event.type;
    }
    
    protected extractTokensFromEvent(event: any): number {
        if (event.usage) {
            return (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0);
        }
        return 0;
    }
    
    protected isTerminalEvent(result: StreamEvent): boolean {
        return result.type === StreamEventType.COMPLETED || result.type === StreamEventType.ERROR;
    }
    
    // Преобразование Tool в формат Claude
    protected convertToolToClaudeFormat(tool: Tool): Anthropic.Tool {
        console.log(`[ClaudeConversation] Преобразую инструмент: ${tool.name}`);
        
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
        if (!inputSchema.type) inputSchema.type = "object";
        if (!inputSchema.properties) inputSchema.properties = {};
        if (!inputSchema.required) inputSchema.required = [];
        
        const claudeTool: Anthropic.Tool = {
            name: tool.name,
            description: tool.description,
            input_schema: inputSchema
        };
        
        console.log(`[ClaudeConversation] Преобразованный инструмент:`, JSON.stringify(claudeTool, null, 2));
        return claudeTool;
    }
    
    protected convertToolToProviderFormat(tool: Tool): any {
        return this.convertToolToClaudeFormat(tool);
    }
    
    protected convertToProviderFormat(messages: ContentBlock[]): Anthropic.MessageParam[] {
        console.log(`[ClaudeConversation] Начинаю преобразование ${messages.length} сообщений`);
        
        return messages
            .filter(msg => {
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
                    
                    return {
                        role: "user" as const,
                        content
                    };
                }
                
                // Обработка обычных сообщений
                if (typeof msg.data === "string") {
                    content = msg.data;
                } else if (typeof msg.data === "object" && msg.data !== null) {
                    const msgData = msg.data as any;
                    role = msgData.role || "user";
                    
                    if (msgData.tool_calls) {
                        // Сообщение ассистента с вызовами функций
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
                    } else {
                        content = msgData.content || "";
                    }
                }
                
                const claudeRole = role === "system" ? "system" : 
                                 role === "assistant" ? "assistant" : "user";
                
                return {
                    role: claudeRole as "user" | "assistant" | "system",
                    content
                };
            });
    }
    
    protected async createStream(messages: Anthropic.MessageParam[], options?: ConversationOptions): Promise<any> {
        // Валидация: проверяем, что tool_result имеет соответствующий tool_use
        this.validateToolContext(messages);
        
        // Извлекаем system сообщение если есть
        const systemMessages = messages.filter(msg => msg.role === "system");
        const conversationMessages = messages.filter(msg => msg.role !== "system");
        const systemMessage = systemMessages.length > 0 ? systemMessages[0].content as string : undefined;

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

        // Добавляем инструменты если они есть
        if (options?.tools && options.tools.length > 0) {
            const convertedTools = options.tools.map(tool => this.convertToolToClaudeFormat(tool));
            requestParams.tools = convertedTools;
            console.log(`[ClaudeConversation] Добавлено ${requestParams.tools.length} инструментов`);
        }

        console.log(`[ClaudeConversation] Создаю стрим через Claude Messages API...`);
        return await this.anthropic.messages.create(requestParams);
    }
    
    protected async processStreamEvent(event: any, totalTokens: number): Promise<void> {
        const eventType = event.type;
        
        // Собираем контент ассистента для истории
        if (eventType === "content_block_start") {
            if (event.content_block?.type === "text") {
                this.currentContent.push({
                    type: "text",
                    text: event.content_block.text || ""
                });
            } else if (event.content_block?.type === "tool_use") {
                this.currentContent.push({
                    type: "tool_use",
                    id: event.content_block.id,
                    name: event.content_block.name,
                    input: event.content_block.input || {}
                });
            }
        }

        // Обновляем текстовый контент
        if (eventType === "content_block_delta" && event.delta?.type === "text_delta") {
            const lastContent = this.currentContent[this.currentContent.length - 1];
            if (lastContent && lastContent.type === "text") {
                lastContent.text += event.delta.text;
            }
        }

        // Обновляем input для tool_use
        if (eventType === "content_block_delta" && event.delta?.type === "input_json_delta") {
            const lastContent = this.currentContent[this.currentContent.length - 1];
            if (lastContent && lastContent.type === "tool_use") {
                const currentPartial = lastContent._partialInput || "";
                const newPartial = currentPartial + event.delta.partial_json;
                lastContent._partialInput = newPartial;
                
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

        // Сохраняем ответ ассистента в историю при завершении
        if (eventType === "message_stop" && this.currentContent.length > 0) {
            this.assistantMessage = {
                role: "assistant",
                content: this.currentContent.length === 1 && this.currentContent[0].type === "text" 
                    ? this.currentContent[0].text 
                    : this.currentContent
            };
            this.addToHistory(this.assistantMessage);
            this.currentContent = [];
        }
    }
    
    // Валидация контекста tool
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
}