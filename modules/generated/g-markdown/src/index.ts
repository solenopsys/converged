// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type MdFile = {
  path: string;
  content: string;
};

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
  "interfaceName": "MarkdownService",
  "serviceName": "markdown",
  "filePath": "content/markdown.ts",
  "methods": [
    {
      "name": "saveMd",
      "parameters": [
        {
          "name": "mdFile",
          "type": "MdFile",
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
      "name": "readMd",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "MdFile",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "readMdJson",
      "parameters": [
        {
          "name": "path",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "MdFile",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "readMdJsonBatch",
      "parameters": [
        {
          "name": "paths",
          "type": "string",
          "optional": false,
          "isArray": true
        }
      ],
      "returnType": "MdFile",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "listOfMd",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<MdFile>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "MdFile",
      "kind": "type",
      "definition": "{\n  path: string;\n  content: string;\n}"
    },
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
export interface MarkdownService {
  saveMd(mdFile: MdFile): Promise<string>;
  readMd(path: string): Promise<MdFile>;
  readMdJson(path: string): Promise<MdFile>;
  readMdJsonBatch(paths: string[]): Promise<MdFile[]>;
  listOfMd(params: PaginationParams): Promise<PaginatedResult<MdFile>>;
}

// Client interface
export interface MarkdownServiceClient {
  saveMd(mdFile: MdFile): Promise<string>;
  readMd(path: string): Promise<MdFile>;
  readMdJson(path: string): Promise<MdFile>;
  readMdJsonBatch(paths: string[]): Promise<MdFile[]>;
  listOfMd(params: PaginationParams): Promise<PaginatedResult<MdFile>>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createMarkdownServiceClient(
  config: CrullerTransportClientConfig,
): MarkdownServiceClient {
  return createCrullerTransportClient<MarkdownServiceClient>(metadata, config);
}

export function createMarkdownServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): MarkdownServiceClient {
  return createMarkdownServiceClient(config);
}
