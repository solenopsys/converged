
// Типы для базы данных
export interface DatabaseSchema {
    auth_methods: {
        id: string;
        user_id: string;
        type: string;
        identifier: string;
        credential: string | null;
        created_at: string;
    };
    sessions: {
        id: string;
        user_id: string;
        token_hash: string;
        expires_at: string;
        created_at: string;
    };
}

// Типы для вставки данных
export type NewAuthMethod = Omit<DatabaseSchema["auth_methods"], "created_at">;
export type NewSession = Omit<DatabaseSchema["sessions"], "created_at">;

 