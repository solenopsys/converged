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
        
        console.log(`[${this.constructor.name}] Создан новый разговор. ID: ${this.id}, модель: ${this.model}`);
        console.log(`[${this.constructor.name}] Зарегистрировано ${this.handlers.length} обработчиков событий:`);
        this.handlers.forEach((handler, index) => {
            console.log(`  ${index + 1}. ${handler.constructor.name}`);
        });
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
        console.log(`[${this.constructor.name}] История разговора очищена`);
    }
    
    setConversationHistory(history: any[]): void {
        this.conversationHistory = [...history];
        console.log(`[${this.constructor.name}] Установлена история разговора: ${this.conversationHistory.length} сообщений`);
    }
    
    protected addToHistory(message: any): void {
        this.conversationHistory.push(message);
        console.log(`[${this.constructor.name}] Добавлено сообщение в историю. Всего: ${this.conversationHistory.length}`);
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
        console.log(`[${this.constructor.name}] Начинаю отправку ${messages.length} сообщений`);
        console.log(`[${this.constructor.name}] Опции:`, JSON.stringify(options, null, 2));
        
        if (options?.tools) {
            console.log(`[${this.constructor.name}] Доступные инструменты: ${options.tools.map(t => t.name).join(', ')}`);
        }
        
        const maxRetries = 3;
        let attempt = 0;
        
        while (attempt < maxRetries) {
            try {
                // Логируем входящие сообщения пользователя только на первой попытке
                if (attempt === 0) {
                    console.log(`[${this.constructor.name}] Логирую ${messages.length} входящих сообщений`);
                    await Promise.all(
                        messages.map(async (msg, index) => {
                            console.log(`[${this.constructor.name}] Логирую сообщение ${index + 1}/${messages.length} от пользователя`);
                            return this.log(msg, MessageSource.USER);
                        })
                    );

                    // Преобразуем новые сообщения в формат провайдера
                    const newMessages = this.convertToProviderFormat(messages);
                    console.log(`[${this.constructor.name}] Преобразовано ${newMessages.length} новых сообщений`);
                    
                    // Добавляем новые сообщения к истории
                    this.conversationHistory.push(...newMessages);
                    console.log(`[${this.constructor.name}] Общая история: ${this.conversationHistory.length} сообщений`);
                }
                
                // Создаем стрим
                const stream = await this.createStream(this.conversationHistory, options);
                console.log(`[${this.constructor.name}] Стрим создан успешно, начинаю обработку событий (попытка ${attempt + 1})`);

                let totalTokens = 0;
                let eventCount = 0;

                // Обрабатываем события
                for await (const event of stream) {
                    eventCount++;
                    
                    // Обновляем счетчик токенов
                    const newTokens = this.extractTokensFromEvent(event);
                    if (newTokens && newTokens !== totalTokens) {
                        console.log(`[${this.constructor.name}] Обновляю счетчик токенов: ${totalTokens} → ${newTokens}`);
                        totalTokens = newTokens;
                    }

                    // Логируем событие от ассистента
                    console.log(`[${this.constructor.name}] Логирую событие от ассистента`);
                    await this.log(event, MessageSource.ASSISTANT);

                    // Обрабатываем специфичную для провайдера логику
                    await this.processStreamEvent(event, totalTokens);

                    // Ищем подходящий хендлер
                    const eventType = this.getEventType(event);
                    console.log(`[${this.constructor.name}] Событие ${eventCount}: тип="${eventType}"`);
                    
                    const handler = this.handlers.find(h => h.canHandle(eventType));
                    if (handler) {
                        console.log(`[${this.constructor.name}] Найден обработчик для события "${eventType}": ${handler.constructor.name}`);
                        const result = handler.handle(event, totalTokens);
                        if (result) {
                            console.log(`[${this.constructor.name}] Обработчик вернул результат типа: ${result.type}`);
                            
                            // Проверяем на overloaded_error для повторной попытки
                            if (result.type === StreamEventType.ERROR && 
                                (result as any).errorType === "overloaded_error" && 
                                attempt < maxRetries - 1) {
                                console.log(`[${this.constructor.name}] Получена ошибка overloaded_error, повторяю через 2 секунды (попытка ${attempt + 2})`);
                                await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); // Увеличивающая задержка
                                break; // Выходим из внутреннего цикла для повторной попытки
                            }
                            
                            yield result;
                            
                            // Завершаем если это completion или error
                            if (this.isTerminalEvent(result)) {
                                console.log(`[${this.constructor.name}] Завершаю обработку стрима. Обработано событий: ${eventCount}`);
                                return;
                            }
                        } else {
                            console.log(`[${this.constructor.name}] Обработчик не вернул результат (null)`);
                        }
                    } else {
                        console.warn(`[${this.constructor.name}] Не найден обработчик для события типа "${eventType}"`);
                    }
                }

                console.log(`[${this.constructor.name}] Стрим завершен. Всего обработано событий: ${eventCount}`);
                return; // Успешно завершили

            } catch (error: any) {
                attempt++;
                console.error(`[${this.constructor.name}] Произошла ошибка на попытке ${attempt}:`, error);
                
                // Проверяем на overloaded_error в исключении
                const isOverloadedError = error?.message?.includes("overloaded_error") || 
                                        error?.error?.type === "overloaded_error";
                
                if (isOverloadedError && attempt < maxRetries) {
                    console.log(`[${this.constructor.name}] Повторяю запрос через ${2 * attempt} секунд (попытка ${attempt + 1})`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                    continue;
                }
                
                console.error(`[${this.constructor.name}] Стек ошибки:`, error.stack);
                
                // Логируем ошибку
                await this.log({ error: error.message }, MessageSource.ASSISTANT);
                
                yield {
                    type: StreamEventType.ERROR,
                    message: error?.message || "Request failed",
                    tokens: 0
                };
                return;
            }
        }
    }
    
    // Вспомогательные методы для извлечения информации из событий
    protected abstract getEventType(event: any): string;
    protected abstract extractTokensFromEvent(event: any): number;
    protected abstract isTerminalEvent(result: StreamEvent): boolean;
}