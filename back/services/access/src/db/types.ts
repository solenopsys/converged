
// Типы для базы данных
export interface DatabaseSchema {
    policies: {
        id: string;
        name: string;
        rules: string;
        effect: string;
        priority: number;
    };
}

// Типы для вставки данных
export type NewPolicy = DatabaseSchema["policies"];

