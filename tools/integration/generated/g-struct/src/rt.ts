// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

const metadata: ServiceMetadata = {
  "interfaceName": "StructService",
  "serviceName": "struct",
  "filePath": "services/content/struct.ts",
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
      "returnType": "PaginatedResult<string>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface StructServiceRtClient {
  saveJson(path: string, data: any): string;
  readJson(path: string): any;
  readJsonBatch(paths: string[]): any[];
  deleteJson(path: string): void;
  listJson(params: PaginationParams): PaginatedResult<string>;
}

export function createStructServiceRtClient(): StructServiceRtClient {
  return createRtClient<StructServiceRtClient>(metadata);
}
