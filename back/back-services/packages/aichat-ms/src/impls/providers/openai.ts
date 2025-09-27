import OpenAI from "openai";
import { randomUUID } from "crypto";
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


// Обработчик текстовых дельт для OpenAI Chat Completions
class OpenAITextDeltaHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "content_delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        // В Chat Completions API структура: event.choices[0].delta.content
        const delta = event.choices?.[0]?.delta;
        if (delta?.content) {
            const textContent = delta.content;
            console.log(`[OpenAITextDeltaHandler] Обрабатываю текстовую дельту: "${textContent}", токенов: ${totalTokens}`);
            return {
                type: StreamEventType.TEXT_DELTA,
                content: textContent,
                tokens: totalTokens
            };
        }
        return null;
    }
}

// Обработчик вызовов функций для OpenAI Chat Completions
class OpenAIToolCallHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "tool_calls_delta";
    }
    
    handle(event: any, totalTokens: number): StreamEvent | null {
        // В Chat Completions API структура: event.choices[0].delta.tool_calls
        const delta = event.choices?.[0]?.delta;
        const toolCalls = delta?.tool_calls;
        
        if (!toolCalls || !Array.isArray(toolCalls)) {
            return null;
        }

        // Обрабатываем каждый tool call
        for (const toolCall of toolCalls) {
            if (toolCall.type === "function" && toolCall.function) {
                console.log(`[OpenAIToolCallHandler] Обрабатываю вызов функции: ${toolCall.function.name || 'unknown'}`);
                
                let parsedArgs = {};
                if (toolCall.function.arguments) {
                    try {
                        parsedArgs = JSON.parse(toolCall.function.arguments);
                    } catch (e) {
                        console.warn(`[OpenAIToolCallHandler] Не удалось распарсить аргументы: ${toolCall.function.arguments}`);
                        parsedArgs = { raw: toolCall.function.arguments };
                    }
                }
                
                return {
                    type: StreamEventType.TOOL_CALL,
                    id: toolCall.id || randomUUID(),
                    name: toolCall.function.name || "",
                    args: parsedArgs,
                    tokens: totalTokens
                };
            }
        }
        
        return null;
    }
}

// Обработчик завершения для OpenAI Chat Completions
class OpenAICompletionHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "done";
    }
    
    handle(event: any, totalTokens: number): StreamEvent {
        const finishReason = event.choices?.[0]?.finish_reason || "stop";
        console.log(`[OpenAICompletionHandler] Завершаю обработку. Причина: ${finishReason}, токенов: ${totalTokens}`);
        
        return {
            type: StreamEventType.COMPLETED,
            finishReason,
            tokens: totalTokens
        };
    }
}

// Обработчик ошибок для OpenAI
class OpenAIErrorHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "error";
    }
    
    handle(event: any, totalTokens: number): StreamEvent {
        const errorMessage = event.error?.message || "Unknown error";
        console.error(`[OpenAIErrorHandler] Обрабатываю ошибку: ${errorMessage}, токенов: ${totalTokens}`);
        
        return {
            type: StreamEventType.ERROR,
            message: errorMessage,
            tokens: totalTokens
        };
    }
}

// Реализация для OpenAI с Chat Completions API
export class OpenAIConversation extends BaseConversation {
    private openai: OpenAI;
    
    constructor(model: string, apiKey: string, log: LogFunction) {
        super(model, log);
        this.openai = new OpenAI({ apiKey });
    }
    
    protected initializeHandlers(): void {
        this.handlers = [
            new OpenAITextDeltaHandler(this),
            new OpenAIToolCallHandler(this),
            new OpenAICompletionHandler(this),
            new OpenAIErrorHandler(this)
        ];
    }
    
    protected getEventType(event: any): string {
        // Chat Completions API использует простые типы событий
        if (event.choices?.[0]?.delta?.content) return "content_delta";
        if (event.choices?.[0]?.delta?.tool_calls) return "tool_calls_delta";
        if (event.choices?.[0]?.finish_reason) return "done";
        return event.type || "unknown";
    }
    
    protected extractTokensFromEvent(event: any): number {
        return event.usage?.total_tokens || 0;
    }
    
    protected isTerminalEvent(result: StreamEvent): boolean {
        return result.type === StreamEventType.COMPLETED || result.type === StreamEventType.ERROR;
    }
    
    // Преобразование Tool в формат OpenAI Chat Completions
    protected convertToolToProviderFormat(tool: Tool): any {
        return {
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
            }
        };
    }
    
    protected convertToProviderFormat(messages: ContentBlock[]): any[] {
        console.log(`[OpenAIConversation] Начинаю преобразование ${messages.length} сообщений`);
        
        return messages.map((msg, index) => {
            let role = "user";
            let content: any = "";
            let toolCallId: string | undefined;
            let toolCalls: any[] | undefined;
            
            if (typeof msg.data === "string") {
                content = msg.data;
            } else if (typeof msg.data === "object" && msg.data !== null) {
                const msgData = msg.data as any;
                role = msgData.role || "user";
                content = msgData.content || "";
                
                // Обработка tool_result для OpenAI Chat Completions
                if (msg.type === "tool_result") {
                    role = "tool";
                    content = typeof msgData.data === 'string' 
                        ? msgData.data 
                        : JSON.stringify(msgData.data || msgData);
                    toolCallId = msgData.tool_call_id || msg.tool_call_id;
                }
                
                // Обработка tool_calls от ассистента
                if (msgData.tool_calls) {
                    toolCalls = msgData.tool_calls.map((tc: any) => ({
                        id: tc.id,
                        type: "function",
                        function: {
                            name: tc.function?.name || tc.name,
                            arguments: typeof tc.function?.arguments === 'string' 
                                ? tc.function.arguments 
                                : JSON.stringify(tc.function?.arguments || tc.args || {})
                        }
                    }));
                }
            }
            
            console.log(`[OpenAIConversation] Преобразую сообщение ${index + 1}: роль="${role}", длина контента=${content?.length || 0} символов`);
            
            const message: any = { role, content };
            if (toolCallId) message.tool_call_id = toolCallId;
            if (toolCalls) message.tool_calls = toolCalls;
            
            return message;
        });
    }
    
    protected async createStream(messages: any[], options?: ConversationOptions): Promise<any> {
        // Подготавливаем параметры запроса для Chat Completions API
        const requestParams: any = {
            model: this.model,
            messages: messages, // Chat Completions использует messages
            stream: true,
            temperature: options?.temperature,
            max_tokens: options?.maxTokens
        };

        // Добавляем инструменты если они есть
        if (options?.tools && options.tools.length > 0) {
            requestParams.tools = options.tools.map(tool => this.convertToolToProviderFormat(tool));
            console.log(`[OpenAIConversation] Добавлено ${requestParams.tools.length} инструментов`);
        }

        console.log(`[OpenAIConversation] Создаю стрим через OpenAI Chat Completions API...`);
        console.log(`[OpenAIConversation] Параметры запроса:`, JSON.stringify({
            ...requestParams,
            messages: `[${requestParams.messages?.length || 0} messages]`
        }, null, 2));
        
        return await this.openai.chat.completions.create(requestParams);
    }
    
    protected async processStreamEvent(event: any, totalTokens: number): Promise<void> {
        // Базовый класс уже управляет историей, здесь ничего не нужно делать
        console.log(`[OpenAIConversation] Обрабатываю событие Chat Completions`);
    }
}