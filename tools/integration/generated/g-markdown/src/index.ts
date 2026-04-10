// Auto-generated package
import { createHttpClient } from "nrpc";

export type MdFile = {
  path: string;
  content: string;
};

export type PaginatedResult = {
  items: T[];
  totalCount?: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export const metadata = {
  "interfaceName": "MarkdownService",
  "serviceName": "markdown",
  "filePath": "../types/markdown.ts",
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
      "returnType": "PaginatedResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "MdFile",
      "definition": "{\n  path: string;\n  content: string;\n}"
    },
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
export interface MarkdownService {
  saveMd(mdFile: MdFile): Promise<string>;
  readMd(path: string): Promise<MdFile>;
  readMdJson(path: string): Promise<MdFile>;
  readMdJsonBatch(paths: string[]): Promise<MdFile[]>;
  listOfMd(params: PaginationParams): Promise<PaginatedResult>;
}

// Client interface
export interface MarkdownServiceClient {
  saveMd(mdFile: MdFile): Promise<string>;
  readMd(path: string): Promise<MdFile>;
  readMdJson(path: string): Promise<MdFile>;
  readMdJsonBatch(paths: string[]): Promise<MdFile[]>;
  listOfMd(params: PaginationParams): Promise<PaginatedResult>;
}

// Factory function
export function createMarkdownServiceClient(
  config?: { baseUrl?: string },
): MarkdownServiceClient {
  return createHttpClient<MarkdownServiceClient>(metadata, config);
}

// Ready-to-use client
export const markdownClient = createMarkdownServiceClient();
