export type FunctionType = "front" | "back";

export type FunctionDef = {
    id: string;
    brief: string;
    description: string;
    category?: string;
    type: FunctionType;
    contentHash: string;
    registeredAt: number;
    updatedAt: number;
};

export type FunctionInput = {
    id: string;
    brief: string;
    description: string;
    category?: string;
    type: FunctionType;
};

export type FunctionSearchResult = {
    id: string;
    brief: string;
    description: string;
    category?: string;
    type: FunctionType;
    score: number;
};

export type PaginationParams = {
    offset: number;
    limit: number;
};

export type PaginatedResult<T> = {
    items: T[];
    totalCount?: number;
};

export interface FunctionsService {
    registerFunctions(functions: FunctionInput[]): Promise<void>;
    listFunctions(type?: FunctionType, category?: string): Promise<FunctionDef[]>;
    getFunction(id: string): Promise<FunctionDef | null>;
    searchFunctions(query: string, limit?: number): Promise<FunctionSearchResult[]>;
    deleteFunction(id: string): Promise<void>;
}
