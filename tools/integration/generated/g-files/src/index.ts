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

export type PaginatedResult<T> = {
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
  "filePath": "services/data/files.ts",
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
      "returnType": "UUID",
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
      "returnType": "HashString",
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
      "returnType": "void",
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
      "returnType": "void",
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
      "returnType": "FileMetadata",
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
      "returnType": "FileChunk",
      "isAsync": true,
      "returnTypeIsArray": true,
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
      "returnType": "PaginatedResult<FileMetadata>",
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
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "UUID",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n    key: string;\n    offset: number;\n    limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n    items: T[];\n    totalCount?: number;\n}"
    },
    {
      "name": "FileStatus",
      "kind": "type",
      "definition": "'uploading' | 'uploaded' | 'failed'"
    },
    {
      "name": "FileMetadata",
      "kind": "type",
      "definition": "{\n    id:UUID\n    hash: HashString; \n    status: FileStatus;\n    name: string;\n    fileSize: number;\n    fileType: string;\n    compression: string;\n    owner: string;\n    createdAt: ISODateString; \n    chunksCount: number;\n}"
    },
    {
      "name": "FileChunk",
      "kind": "type",
      "definition": "{\n    fileId:UUID\n    hash: HashString;\n    chunkNumber: number;\n    chunkSize: number;\n    createdAt: ISODateString; \n}"
    },
    {
      "name": "FileStatistic",
      "kind": "type",
      "definition": "{\n    totalFiles: number;\n    totalChunks: number;\n    totalSize: number;\n    createdAt: ISODateString;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface FilesService {
  save(file: FileMetadata): Promise<UUID>;
  saveChunk(chunk: FileChunk): Promise<HashString>;
  update(id: UUID, file: FileMetadata): Promise<void>;
  delete(id: UUID): Promise<void>;
  get(id: UUID): Promise<FileMetadata>;
  getChunks(id: UUID): Promise<FileChunk[]>;
  list(params: PaginationParams): Promise<PaginatedResult<FileMetadata>>;
  statistic(): Promise<any>;
}

// Client interface
export interface FilesServiceClient {
  save(file: FileMetadata): Promise<UUID>;
  saveChunk(chunk: FileChunk): Promise<HashString>;
  update(id: UUID, file: FileMetadata): Promise<void>;
  delete(id: UUID): Promise<void>;
  get(id: UUID): Promise<FileMetadata>;
  getChunks(id: UUID): Promise<FileChunk[]>;
  list(params: PaginationParams): Promise<PaginatedResult<FileMetadata>>;
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
