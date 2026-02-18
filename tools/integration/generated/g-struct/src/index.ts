// Auto-generated package
import { createHttpClient } from "nrpc";

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

export const metadata = {
  "interfaceName": "StructService",
  "serviceName": "struct",
  "filePath": "../types/struct.ts",
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
      "returnType": "any",
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
      "returnTypeIsArray": false,
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "PaginatedResult",
      "definition": "",
      "properties": [
        {
          "name": "items",
          "type": "T",
          "optional": false,
          "isArray": true
        },
        {
          "name": "totalCount",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "PaginationParams",
      "definition": "",
      "properties": [
        {
          "name": "offset",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "limit",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface StructService {
  saveJson(path: string, data: any): Promise<any>;
  readJson(path: string): Promise<any>;
  readJsonBatch(paths: string[]): Promise<any>;
  deleteJson(path: string): Promise<any>;
  listJson(params: PaginationParams): Promise<any>;
}

// Client interface
export interface StructServiceClient {
  saveJson(path: string, data: any): Promise<any>;
  readJson(path: string): Promise<any>;
  readJsonBatch(paths: string[]): Promise<any>;
  deleteJson(path: string): Promise<any>;
  listJson(params: PaginationParams): Promise<any>;
}

// Factory function
export function createStructServiceClient(
  config?: { baseUrl?: string },
): StructServiceClient {
  return createHttpClient<StructServiceClient>(metadata, config);
}

// Ready-to-use client
export const structClient = createStructServiceClient();
