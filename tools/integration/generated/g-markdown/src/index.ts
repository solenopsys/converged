// Auto-generated package
import { createHttpClient } from "nrpc";

export type MdFile = {
  path: string;
  content: string;
};

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
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
export interface MarkdownService {
  saveMd(mdFile: MdFile): Promise<any>;
  readMd(path: string): Promise<any>;
  readMdJson(path: string): Promise<any>;
  readMdJsonBatch(paths: string[]): Promise<any>;
  listOfMd(params: PaginationParams): Promise<any>;
}

// Client interface
export interface MarkdownServiceClient {
  saveMd(mdFile: MdFile): Promise<any>;
  readMd(path: string): Promise<any>;
  readMdJson(path: string): Promise<any>;
  readMdJsonBatch(paths: string[]): Promise<any>;
  listOfMd(params: PaginationParams): Promise<any>;
}

// Factory function
export function createMarkdownServiceClient(
  config?: { baseUrl?: string },
): MarkdownServiceClient {
  return createHttpClient<MarkdownServiceClient>(metadata, config);
}

// Ready-to-use client
export const markdownClient = createMarkdownServiceClient();
