import { randomUUID } from "crypto";
import {
    StreamEvent,
    EventHandler,
    AiConversation,
    MessageSource,
    LogFunction,
    ConversationOptions,
    ContentBlock,
    StreamEventType,
    Tool
} from "../types";


// Абстрактный базовый класс для всех разговоров
export abstract class BaseConversation implements AiConversation {
    protected id: string;
    protected model: string;
    protected log: LogFunction;
    protected conversationHistory: any[] = []; // История в универсальном формате
    protected handlers: EventHandler[] = [];

    constructor(model: string, log: LogFunction) {
        this.id = randomUUID();
        this.model = model;
        this.log = log;

        this.initializeHandlers();
    }

    getId(): string {
        return this.id;
    }

    // Методы для работы с историей разговора
    getConversationHistory(): any[] {
        return [...this.conversationHistory];
    }

    clearHistory(): void {
        this.conversationHistory = [];
    }

    setConversationHistory(history: any[]): void {
        this.conversationHistory = [...history];
    }

    protected addToHistory(message: any): void {
        this.conversationHistory.push(message);
    }

    // Абстрактные методы, которые должны реализовать наследники
    protected abstract initializeHandlers(): void;
    protected abstract convertToProviderFormat(messages: ContentBlock[]): any[];
    protected abstract convertToolToProviderFormat(tool: Tool): any;
    protected abstract createStream(messages: any[], options?: ConversationOptions): Promise<any>;
    protected abstract processStreamEvent(event: any, totalTokens: number): Promise<void>;

    // Общая логика отправки сообщений
    async* send(
        messages: ContentBlock[],
        options?: ConversationOptions
    ): AsyncIterable<StreamEvent> {
        messages.forEach((msg, index) => {
            this.log(msg, MessageSource.USER).catch(err =>
                console.error(`[${this.constructor.name}] Ошибка логирования сообщения ${index + 1}:`, err),
            );
        });

        const newMessages = this.convertToProviderFormat(messages);
        this.conversationHistory.push(...newMessages);

        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            let stream: any;

            try {
                stream = await this.createStream(this.conversationHistory, options);
            } catch (error: any) {
                if (this.isOverloadedError(error) || attempt >= maxRetries - 1) {
                    await this.log({ error: error?.message }, MessageSource.ASSISTANT);
                    yield {
                        type: StreamEventType.ERROR,
                        message: error?.message || "Request failed",
                        tokens: 0,
                    };
                    return;
                }

                attempt++;
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                continue;
            }

            let totalTokens = 0;
            let streamStarted = false;

            try {
                for await (const event of stream) {
                    streamStarted = true;

                    const newTokens = this.extractTokensFromEvent(event);
                    if (newTokens && newTokens !== totalTokens) {
                        totalTokens = newTokens;
                    }

                    this.log(event, MessageSource.ASSISTANT).catch(err =>
                        console.error(`[${this.constructor.name}] Ошибка логирования:`, err),
                    );

                    await this.processStreamEvent(event, totalTokens);

                    const eventType = this.getEventType(event);
                    const handler = this.handlers.find(h => h.canHandle(eventType));
                    if (!handler) {
                        continue;
                    }

                    const result = handler.handle(event, totalTokens);
                    if (!result) {
                        continue;
                    }

                    yield result;

                    if (this.isTerminalEvent(result)) {
                        return;
                    }
                }

                return;
            } catch (error: any) {
                if (streamStarted) {
                    await this.log({ error: error?.message }, MessageSource.ASSISTANT);
                    yield {
                        type: StreamEventType.ERROR,
                        message: error?.message || "Request failed",
                        tokens: 0,
                    };
                    return;
                }

                if (this.isOverloadedError(error) || attempt >= maxRetries - 1) {
                    await this.log({ error: error?.message }, MessageSource.ASSISTANT);
                    yield {
                        type: StreamEventType.ERROR,
                        message: error?.message || "Request failed",
                        tokens: 0,
                    };
                    return;
                }

                attempt++;
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }

    // Вспомогательные методы для извлечения информации из событий
    protected abstract getEventType(event: any): string;
    protected abstract extractTokensFromEvent(event: any): number;
    protected abstract isTerminalEvent(result: StreamEvent): boolean;

    private isOverloadedError(error: any): boolean {
        return Boolean(
            error?.message?.includes("overloaded_error") ||
            error?.error?.type === "overloaded_error",
        );
    }
}
