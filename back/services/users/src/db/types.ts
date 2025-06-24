
// Типы для базы данных
export interface DatabaseSchema {
    users: {
        id: string;
        email: string;
        name: string | null;
        created_at: string;
    };
    user_attributes: {
        user_id: string;
        attributes: string;
    };
}

// Типы для вставки данных
export type NewUser = Omit<DatabaseSchema["users"], "created_at">;
export type NewUserAttributes = DatabaseSchema["user_attributes"];

