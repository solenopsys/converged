// Auto-generated package
import { createHttpClient } from "nrpc";

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

export const metadata = {
  "interfaceName": "FunctionsService",
  "serviceName": "functions",
  "filePath": "services/ai/functions.ts",
  "methods": [
    {
      "name": "registerFunctions",
      "parameters": [
        {
          "name": "functions",
          "type": "FunctionInput",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listFunctions",
      "parameters": [
        {
          "name": "type",
          "type": "FunctionType",
          "optional": true,
          "isArray": false
        },
        {
          "name": "category",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "FunctionDef",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getFunction",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "FunctionDef | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "searchFunctions",
      "parameters": [
        {
          "name": "query",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "limit",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "FunctionSearchResult",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "deleteFunction",
      "parameters": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "FunctionType",
      "kind": "type",
      "definition": "\"front\" | \"back\""
    },
    {
      "name": "FunctionDef",
      "kind": "type",
      "definition": "{\n    id: string;\n    brief: string;\n    description: string;\n    category?: string;\n    type: FunctionType;\n    contentHash: string;\n    registeredAt: number;\n    updatedAt: number;\n}"
    },
    {
      "name": "FunctionInput",
      "kind": "type",
      "definition": "{\n    id: string;\n    brief: string;\n    description: string;\n    category?: string;\n    type: FunctionType;\n}"
    },
    {
      "name": "FunctionSearchResult",
      "kind": "type",
      "definition": "{\n    id: string;\n    brief: string;\n    description: string;\n    category?: string;\n    type: FunctionType;\n    score: number;\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n    offset: number;\n    limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n    items: T[];\n    totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface FunctionsService {
  registerFunctions(functions: FunctionInput[]): Promise<void>;
  listFunctions(type?: FunctionType, category?: string): Promise<FunctionDef[]>;
  getFunction(id: string): Promise<FunctionDef | any>;
  searchFunctions(query: string, limit?: number): Promise<FunctionSearchResult[]>;
  deleteFunction(id: string): Promise<void>;
}

// Client interface
export interface FunctionsServiceClient {
  registerFunctions(functions: FunctionInput[]): Promise<void>;
  listFunctions(type?: FunctionType, category?: string): Promise<FunctionDef[]>;
  getFunction(id: string): Promise<FunctionDef | any>;
  searchFunctions(query: string, limit?: number): Promise<FunctionSearchResult[]>;
  deleteFunction(id: string): Promise<void>;
}

// Factory function
export function createFunctionsServiceClient(
  config?: { baseUrl?: string },
): FunctionsServiceClient {
  return createHttpClient<FunctionsServiceClient>(metadata, config);
}

// Ready-to-use client
export const functionsClient = createFunctionsServiceClient();
