// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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
};

const metadata: ServiceMetadata = {
  "interfaceName": "MarkdownService",
  "serviceName": "markdown",
  "filePath": "services/content/markdown.ts",
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
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface MarkdownServiceRtClient {
  saveMd(mdFile: MdFile): string;
  readMd(path: string): MdFile;
  readMdJson(path: string): MdFile;
  readMdJsonBatch(paths: string[]): MdFile[];
  listOfMd(params: PaginationParams): PaginatedResult<MdFile>;
}

export function createMarkdownServiceRtClient(): MarkdownServiceRtClient {
  return createRtClient<MarkdownServiceRtClient>(metadata);
}
