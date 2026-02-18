import { StreamEvent } from "../types";
import { BaseConversation } from "./conversation";

// Обновленный базовый класс для обработчиков событий с доступом к разговору
export abstract class EventHandler {
    protected conversation: BaseConversation;
    
    constructor(conversation: BaseConversation) {
        this.conversation = conversation;
    }
    
    abstract canHandle(eventType: string): boolean;
    abstract handle(event: any, totalTokens: number): StreamEvent | null;
    
    // Методы для работы с историей разговора
    protected getConversationHistory(): any[] {
        return this.conversation.getConversationHistory();
    }
    
    protected clearHistory(): void {
        this.conversation.clearHistory();
    }
    
    protected setConversationHistory(history: any[]): void {
        this.conversation.setConversationHistory(history);
    }
}