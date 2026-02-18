import type Anthropic from "@anthropic-ai/sdk";
import { BaseConversation } from "../conversation";
import { EventHandler } from "../hendler";
import {
    StreamEvent,
    LogFunction,
    ConversationOptions,
    ContentBlock,
    ContentType,
    Tool,
    StreamEventType
} from "../../types";

const PARTIAL_JSON_LIMIT = 10000;

// Обработчик текстовых дельт для Claude
class ClaudeTextDeltaHandler extends EventHandler {
    canHandle(eventType: string): boolean {
        return eventType === "content_block_delta";
    }

    handle(event: any, totalTokens: number): StreamEvent | null {
        // Проверяем, что это текстовая дельта
        if (event?.delta?.type === "text_delta") {
            const textContent = event.delta?.text || "";
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
            return {
                type: StreamEventType.TEXT_DELTA,
                content: event.content_block?.text || "",
                tokens: totalTokens
            };
        }

        // Обрабатываем начало tool use блока
        if (event.content_block?.type === "tool_use") {
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
            if (newPartial.length > PARTIAL_JSON_LIMIT) {
                this.currentArgs.set(blockIndex, "");
                return {
                    type: StreamEventType.TOOL_CALL,
                    id: blockIndex,
                    name: "",
                    args: { _partial: "" },
                    tokens: totalTokens,
                };
            }

            this.currentArgs.set(blockIndex, newPartial);

            // Пытаемся парсить JSON если он завершен
            let parsedArgs = {};
            try {
                // Проверяем, является ли JSON завершенным
                if (newPartial.trim() && (newPartial.trim().endsWith('}') || newPartial.trim().endsWith(']'))) {
                    parsedArgs = JSON.parse(newPartial);
                } else {
                    // Если JSON не завершен, отправляем как есть
                    parsedArgs = { _partial: newPartial };
                }
            } catch (e) {
                // Если не удается парсить, сохраняем как partial
                parsedArgs = { _partial: newPartial };
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
        void event;
        void totalTokens;
        return null;
    }
}

// Обработчик завершения для Claude
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
    private toolUseIds = new Set<string>();

    constructor(model: string, client: Anthropic, log: LogFunction) {
        super(model, log);
        this.anthropic = client;
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
        return claudeTool;
    }

    protected convertToolToProviderFormat(tool: Tool): any {
        return this.convertToolToClaudeFormat(tool);
    }

    protected convertToProviderFormat(messages: ContentBlock[]): Anthropic.MessageParam[] {
        return messages
            .filter(msg => {
                const isValidType = msg.type === ContentType.TEXT || msg.type === "tool_result";
                return isValidType;
            })
            .map((msg) => {
                let role = "user";
                let content: string | Anthropic.MessageParam['content'] = "";

                // Обработка tool_result сообщений
                if (msg.type === "tool_result") {
                    const toolResultData = msg.data as any;
                    const toolUseId = toolResultData.tool_call_id || msg.tool_call_id;

                    if (!toolUseId) {
                        throw new Error("tool_result is missing tool_use_id");
                    }

                    if (!this.toolUseIds.has(toolUseId)) {
                        throw new Error(
                            `Tool result with ID ${toolUseId} has no corresponding tool_use in conversation history`,
                        );
                    }

                    content = [
                        {
                            type: "tool_result",
                            tool_use_id: toolUseId,
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

                        content.forEach((block: any) => {
                            if (block?.type === "tool_use" && block.id) {
                                this.toolUseIds.add(block.id);
                            }
                        });

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
        }

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
                if (newPartial.length > PARTIAL_JSON_LIMIT) {
                    lastContent._partialInput = "";
                    return;
                }
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

    setConversationHistory(history: Anthropic.MessageParam[]): void {
        super.setConversationHistory(history);
        this.toolUseIds.clear();
        history.forEach((message) => this.recordToolUseIds(message));
    }

    protected addToHistory(message: Anthropic.MessageParam): void {
        super.addToHistory(message);
        this.recordToolUseIds(message);
    }

    private recordToolUseIds(message: Anthropic.MessageParam): void {
        const content = Array.isArray(message.content)
            ? message.content
            : [message.content];

        content.forEach((block: any) => {
            if (block?.type === "tool_use" && block.id) {
                this.toolUseIds.add(block.id);
            }
        });
    }
}
