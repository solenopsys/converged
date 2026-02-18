// Auto-generated frontend client
import { createHttpClient } from 'nrpc';

export type HashString = string;

export type CompressionType = "none" | "deflate" | "gzip" | "brotli";

export interface PaginationParams {
  key: string;
  offset: number;
  limit: number;
}

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export interface BlockMetadata {
  hash: HashString;
  size: number;
  originalSize: number;
  compression: CompressionType;
  owner: string;
}

const metadata = {
  "interfaceName": "StoreService",
  "serviceName": "store",
  "filePath": "types/store.ts",
  "methods": [
    {
      "name": "save",
      "parameters": [
        {
          "name": "data",
          "type": "Uint8Array",
          "optional": false,
          "isArray": false
        },
        {
          "name": "originalSize",
          "type": "number",
          "optional": true,
          "isArray": false
        },
        {
          "name": "compression",
          "type": "CompressionType",
          "optional": true,
          "isArray": false
        },
        {
          "name": "owner",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveWithHash",
      "parameters": [
        {
          "name": "hash",
          "type": "HashString",
          "optional": false,
          "isArray": false
        },
        {
          "name": "data",
          "type": "Uint8Array",
          "optional": false,
          "isArray": false
        },
        {
          "name": "originalSize",
          "type": "number",
          "optional": true,
          "isArray": false
        },
        {
          "name": "compression",
          "type": "CompressionType",
          "optional": true,
          "isArray": false
        },
        {
          "name": "owner",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "delete",
      "parameters": [
        {
          "name": "hash",
          "type": "HashString",
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
      "name": "get",
      "parameters": [
        {
          "name": "hash",
          "type": "HashString",
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
      "name": "getWithMeta",
      "parameters": [
        {
          "name": "hash",
          "type": "HashString",
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
      "name": "exists",
      "parameters": [
        {
          "name": "hash",
          "type": "HashString",
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
      "name": "list",
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
    },
    {
      "name": "storeStatistic",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "HashString",
      "definition": "string"
    },
    {
      "name": "CompressionType",
      "definition": "\"none\" | \"deflate\" | \"gzip\" | \"brotli\""
    },
    {
      "name": "PaginationParams",
      "definition": "",
      "properties": [
        {
          "name": "key",
          "type": "string",
          "optional": false,
          "isArray": false
        },
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
    },
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
      "name": "BlockMetadata",
      "definition": "",
      "properties": [
        {
          "name": "hash",
          "type": "HashString",
          "optional": false,
          "isArray": false
        },
        {
          "name": "size",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "originalSize",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "compression",
          "type": "CompressionType",
          "optional": false,
          "isArray": false
        },
        {
          "name": "owner",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ]
    }
  ]
};

// Service client interface
export interface StoreServiceClient {
  save(data: Uint8Array, originalSize?: number, compression?: CompressionType, owner?: string): Promise<any>;
  saveWithHash(hash: HashString, data: Uint8Array, originalSize?: number, compression?: CompressionType, owner?: string): Promise<any>;
  delete(hash: HashString): Promise<any>;
  get(hash: HashString): Promise<any>;
  getWithMeta(hash: HashString): Promise<any>;
  exists(hash: HashString): Promise<any>;
  list(params: PaginationParams): Promise<any>;
  storeStatistic(): Promise<any>;
}

// Factory function
export function createStoreServiceClient(config?: { baseUrl?: string }): StoreServiceClient {
  return createHttpClient<StoreServiceClient>(metadata, config);
}

// Export ready-to-use client
export const storeClient = createStoreServiceClient();
