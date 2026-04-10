// Auto-generated package
import { createHttpClient } from "nrpc";

export type StorageInfo = {
  name: string;
  size: number;
};

export type StorageStats = {
  totalSize: number;
  storageCount: number;
  storages: StorageInfo[];
};

export type DumpFile = {
  name: string;
  fileName: string;
  size?: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export const metadata = {
  "interfaceName": "DumpsService",
  "serviceName": "dumps",
  "filePath": "../types/dumps.ts",
  "methods": [
    {
      "name": "listStorages",
      "parameters": [],
      "returnType": "StorageInfo",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "storageStats",
      "parameters": [],
      "returnType": "StorageStats",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listDumps",
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
    },
    {
      "name": "dump",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "DumpFile",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getLink",
      "parameters": [
        {
          "name": "fileName",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "StorageInfo",
      "definition": "{\n  name: string;\n  size: number;\n}"
    },
    {
      "name": "StorageStats",
      "definition": "{\n  totalSize: number;\n  storageCount: number;\n  storages: StorageInfo[];\n}"
    },
    {
      "name": "DumpFile",
      "definition": "{\n  name: string;\n  fileName: string;\n  size?: number;\n}"
    },
    {
      "name": "PaginationParams",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface DumpsService {
  listStorages(): Promise<StorageInfo[]>;
  storageStats(): Promise<StorageStats>;
  listDumps(params: PaginationParams): Promise<PaginatedResult>;
  dump(name?: string): Promise<DumpFile[]>;
  getLink(fileName: string): Promise<string>;
}

// Client interface
export interface DumpsServiceClient {
  listStorages(): Promise<StorageInfo[]>;
  storageStats(): Promise<StorageStats>;
  listDumps(params: PaginationParams): Promise<PaginatedResult>;
  dump(name?: string): Promise<DumpFile[]>;
  getLink(fileName: string): Promise<string>;
}

// Factory function
export function createDumpsServiceClient(
  config?: { baseUrl?: string },
): DumpsServiceClient {
  return createHttpClient<DumpsServiceClient>(metadata, config);
}

// Ready-to-use client
export const dumpsClient = createDumpsServiceClient();
