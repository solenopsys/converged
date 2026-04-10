// Auto-generated package
import { createHttpClient } from "nrpc";

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export const metadata = {
  "interfaceName": "CeoService",
  "serviceName": "ceo",
  "filePath": "../types/ceo.ts",
  "methods": [
    {
      "name": "saveJson",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "data",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "readJson",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "readJsonBatch",
      "parameters": [
        {
          "name": "paths",
          "type": "string",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "deleteJson",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listJson",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "PaginationParams",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface CeoService {
  saveJson(path: string, data: any): Promise<string>;
  readJson(path: string): Promise<any>;
  readJsonBatch(paths: string[]): Promise<any[]>;
  deleteJson(path: string): Promise<void>;
  listJson(params: PaginationParams): Promise<PaginatedResult>;
}

// Client interface
export interface CeoServiceClient {
  saveJson(path: string, data: any): Promise<string>;
  readJson(path: string): Promise<any>;
  readJsonBatch(paths: string[]): Promise<any[]>;
  deleteJson(path: string): Promise<void>;
  listJson(params: PaginationParams): Promise<PaginatedResult>;
}

// Factory function
export function createCeoServiceClient(
  config?: { baseUrl?: string },
): CeoServiceClient {
  return createHttpClient<CeoServiceClient>(metadata, config);
}

// Ready-to-use client
export const ceoClient = createCeoServiceClient();
