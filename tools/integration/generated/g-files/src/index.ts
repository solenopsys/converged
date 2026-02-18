// Auto-generated package
import { createHttpClient } from "nrpc";

export type HashString = string;

export type UUID = string;

export type ISODateString = string;

export type PaginationParams = {
    key: string;
    offset: number;
    limit: number;
};

export type PaginatedResult = {
    items: T[];
    totalCount?: number;
};

export type FileStatus = 'uploading' | 'uploaded' | 'failed';

export type FileMetadata = {
    id:UUID
    hash: HashString; 
    status: FileStatus;
    name: string;
    fileSize: number;
    fileType: string;
    compression: string;
    owner: string;
    createdAt: ISODateString; 
    chunksCount: number;
};

export type FileChunk = {
    fileId:UUID
    hash: HashString;
    chunkNumber: number;
    chunkSize: number;
    createdAt: ISODateString; 
};

export type FileStatistic = {
    totalFiles: number;
    totalChunks: number;
    totalSize: number;
    createdAt: ISODateString;
};

export const metadata = {
  "interfaceName": "FilesService",
  "serviceName": "files",
  "filePath": "../types/files.ts",
  "methods": [
    {
      "name": "save",
      "parameters": [
        {
          "name": "file",
          "type": "FileMetadata",
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
      "name": "saveChunk",
      "parameters": [
        {
          "name": "chunk",
          "type": "FileChunk",
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
      "name": "update",
      "parameters": [
        {
          "name": "id",
          "type": "UUID",
          "optional": false,
          "isArray": false
        },
        {
          "name": "file",
          "type": "FileMetadata",
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
      "name": "delete",
      "parameters": [
        {
          "name": "id",
          "type": "UUID",
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
      "name": "get",
      "parameters": [
        {
          "name": "id",
          "type": "UUID",
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
      "name": "getChunks",
      "parameters": [
        {
          "name": "id",
          "type": "UUID",
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
      "name": "list",
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
      "name": "statistic",
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
      "definition": "string"
    },
    {
      "name": "UUID",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "definition": "string"
    },
    {
      "name": "PaginationParams",
      "definition": "{\n    key: string;\n    offset: number;\n    limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n    items: T[];\n    totalCount?: number;\n}"
    },
    {
      "name": "FileStatus",
      "definition": "'uploading' | 'uploaded' | 'failed'"
    },
    {
      "name": "FileMetadata",
      "definition": "{\n    id:UUID\n    hash: HashString; \n    status: FileStatus;\n    name: string;\n    fileSize: number;\n    fileType: string;\n    compression: string;\n    owner: string;\n    createdAt: ISODateString; \n    chunksCount: number;\n}"
    },
    {
      "name": "FileChunk",
      "definition": "{\n    fileId:UUID\n    hash: HashString;\n    chunkNumber: number;\n    chunkSize: number;\n    createdAt: ISODateString; \n}"
    },
    {
      "name": "FileStatistic",
      "definition": "{\n    totalFiles: number;\n    totalChunks: number;\n    totalSize: number;\n    createdAt: ISODateString;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface FilesService {
  save(file: FileMetadata): Promise<any>;
  saveChunk(chunk: FileChunk): Promise<any>;
  update(id: UUID, file: FileMetadata): Promise<any>;
  delete(id: UUID): Promise<any>;
  get(id: UUID): Promise<any>;
  getChunks(id: UUID): Promise<any>;
  list(params: PaginationParams): Promise<any>;
  statistic(): Promise<any>;
}

// Client interface
export interface FilesServiceClient {
  save(file: FileMetadata): Promise<any>;
  saveChunk(chunk: FileChunk): Promise<any>;
  update(id: UUID, file: FileMetadata): Promise<any>;
  delete(id: UUID): Promise<any>;
  get(id: UUID): Promise<any>;
  getChunks(id: UUID): Promise<any>;
  list(params: PaginationParams): Promise<any>;
  statistic(): Promise<any>;
}

// Factory function
export function createFilesServiceClient(
  config?: { baseUrl?: string },
): FilesServiceClient {
  return createHttpClient<FilesServiceClient>(metadata, config);
}

// Ready-to-use client
export const filesClient = createFilesServiceClient();
