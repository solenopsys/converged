
// Типы для базы данных
export interface DatabaseSchema {
    chat_conversations: {
        id: string;
        created_at: string;
    };
    chat_messages: {
        id: number;
        conversation_id: string;
        role: string;
        content: string;
        model: string | null;
        meta: string | null;
        ts: string;
    };
    chat_raw_events: {
        id: number;
        conversation_id: string;
        event_type: string | null;
        payload: string | null;
        model: string | null;
        received_at: string;
    };
}

// Типы для вставки данных
export type NewConversation = Omit<
    DatabaseSchema["chat_conversations"],
    "created_at"
>;
export type NewMessage = Omit<DatabaseSchema["chat_messages"], "id" | "ts">;
export type NewRawEvent = Omit<
    DatabaseSchema["chat_raw_events"],
    "id" | "received_at"
>;


// Интерфейс для конфигурации
export interface DatabaseConfig {
    path?: string;
    runMigrations?: boolean;
}
