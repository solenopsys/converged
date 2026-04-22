// Auto-generated package
import { createHttpClient } from "nrpc";

export type HashString = string;

export type CompressionType = "none" | "deflate" | "gzip" | "brotli";

export type PaginationParams = {
  key: string;
  offset: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export type BlockMetadata = {
  hash: HashString;
  size: number;
  originalSize: number;
  compression: CompressionType;
  owner: string;
};

export const metadata = {
  "interfaceName": "StoreService",
  "serviceName": "store",
  "filePath": "services/data/store.ts",
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
      "returnType": "HashString",
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
      "returnType": "HashString",
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
      "returnType": "void",
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
      "returnType": "Uint8Array",
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
      "returnType": "boolean",
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
      "returnType": "PaginatedResult<HashString>",
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
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "CompressionType",
      "kind": "type",
      "definition": "\"none\" | \"deflate\" | \"gzip\" | \"brotli\""
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n  key: string;\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "BlockMetadata",
      "kind": "type",
      "definition": "{\n  hash: HashString;\n  size: number;\n  originalSize: number;\n  compression: CompressionType;\n  owner: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface StoreService {
  save(data: Uint8Array, originalSize?: number, compression?: CompressionType, owner?: string): Promise<HashString>;
  saveWithHash(hash: HashString, data: Uint8Array, originalSize?: number, compression?: CompressionType, owner?: string): Promise<HashString>;
  delete(hash: HashString): Promise<void>;
  get(hash: HashString): Promise<Uint8Array>;
  getWithMeta(hash: HashString): Promise<any>;
  exists(hash: HashString): Promise<boolean>;
  list(params: PaginationParams): Promise<PaginatedResult<HashString>>;
  storeStatistic(): Promise<any>;
}

// Client interface
export interface StoreServiceClient {
  save(data: Uint8Array, originalSize?: number, compression?: CompressionType, owner?: string): Promise<HashString>;
  saveWithHash(hash: HashString, data: Uint8Array, originalSize?: number, compression?: CompressionType, owner?: string): Promise<HashString>;
  delete(hash: HashString): Promise<void>;
  get(hash: HashString): Promise<Uint8Array>;
  getWithMeta(hash: HashString): Promise<any>;
  exists(hash: HashString): Promise<boolean>;
  list(params: PaginationParams): Promise<PaginatedResult<HashString>>;
  storeStatistic(): Promise<any>;
}

// Factory function
export function createStoreServiceClient(
  config?: { baseUrl?: string },
): StoreServiceClient {
  return createHttpClient<StoreServiceClient>(metadata, config);
}

// Ready-to-use client
export const storeClient = createStoreServiceClient();
