// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
  filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;

export const metadata: ServiceMetadata = {
  "interfaceName": "StructService",
  "serviceName": "struct",
  "filePath": "content/struct.ts",
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
      "definition": "{\n  offset: number;\n  limit: number;\n  filter?: FilterObject;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface StructService {
  saveJson(path: string, data: any): Promise<string>;
  readJson(path: string): Promise<any>;
  readJsonBatch(paths: string[]): Promise<any[]>;
  deleteJson(path: string): Promise<void>;
  listJson(params: PaginationParams): Promise<PaginatedResult<string>>;
}

// Client interface
export interface StructServiceClient {
  saveJson(path: string, data: any): Promise<string>;
  readJson(path: string): Promise<any>;
  readJsonBatch(paths: string[]): Promise<any[]>;
  deleteJson(path: string): Promise<void>;
  listJson(params: PaginationParams): Promise<PaginatedResult<string>>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createStructServiceClient(
  config: CrullerTransportClientConfig,
): StructServiceClient {
  return createCrullerTransportClient<StructServiceClient>(metadata, config);
}

export function createStructServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): StructServiceClient {
  return createStructServiceClient(config);
}
