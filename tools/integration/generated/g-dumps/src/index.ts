// Auto-generated package
import { createHttpClient } from "nrpc";

export type StorageInfo = {
  name: string;
  size: number;
};

export type DumpFile = {
  name: string;
  fileName: string;
  size?: number;
};

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export const metadata = {
  "interfaceName": "DumpsService",
  "serviceName": "dumps",
  "filePath": "../types/dumps.ts",
  "methods": [
    {
      "name": "listStorages",
      "parameters": [],
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
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
      "name": "DumpFile",
      "definition": "{\n  name: string;\n  fileName: string;\n  size?: number;\n}"
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
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface DumpsService {
  listStorages(): Promise<any>;
  listDumps(params: PaginationParams): Promise<any>;
  dump(name?: string): Promise<any>;
  getLink(fileName: string): Promise<any>;
}

// Client interface
export interface DumpsServiceClient {
  listStorages(): Promise<any>;
  listDumps(params: PaginationParams): Promise<any>;
  dump(name?: string): Promise<any>;
  getLink(fileName: string): Promise<any>;
}

// Factory function
export function createDumpsServiceClient(
  config?: { baseUrl?: string },
): DumpsServiceClient {
  return createHttpClient<DumpsServiceClient>(metadata, config);
}

// Ready-to-use client
export const dumpsClient = createDumpsServiceClient();
