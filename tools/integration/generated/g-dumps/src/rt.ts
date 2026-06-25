// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "DumpsService",
  "serviceName": "dumps",
  "filePath": "services/data/dumps.ts",
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
      "returnType": "PaginatedResult<DumpFile>",
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
      "kind": "type",
      "definition": "{\n  name: string;\n  size: number;\n}"
    },
    {
      "name": "StorageStats",
      "kind": "type",
      "definition": "{\n  totalSize: number;\n  storageCount: number;\n  storages: StorageInfo[];\n}"
    },
    {
      "name": "DumpFile",
      "kind": "type",
      "definition": "{\n  name: string;\n  fileName: string;\n  size?: number;\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface DumpsServiceRtClient {
  listStorages(): StorageInfo[];
  storageStats(): StorageStats;
  listDumps(params: PaginationParams): PaginatedResult<DumpFile>;
  dump(name?: string): DumpFile[];
  getLink(fileName: string): string;
}

export function createDumpsServiceRtClient(): DumpsServiceRtClient {
  return createRtClient<DumpsServiceRtClient>(metadata);
}
