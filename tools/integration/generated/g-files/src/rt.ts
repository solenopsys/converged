// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

export type FileCollection = {
    id: UUID;
    name: string;
    description?: string;
    owner: string;
    createdAt: ISODateString;
};

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
    collectionId?: UUID;
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

const metadata: ServiceMetadata = {
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
        },
        {
          "name": "processId",
          "type": "string",
          "optional": true,
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
    },
    {
      "name": "saveCollection",
      "parameters": [
        {
          "name": "collection",
          "type": "FileCollection",
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
      "name": "getCollection",
      "parameters": [
        {
          "name": "id",
          "type": "UUID",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "FileCollection",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteCollection",
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
      "name": "listByCollection",
      "parameters": [
        {
          "name": "collectionId",
          "type": "UUID",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "FileMetadata",
      "isAsync": true,
      "returnTypeIsArray": true,
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
      "name": "FileCollection",
      "kind": "type",
      "definition": "{\n    id: UUID;\n    name: string;\n    description?: string;\n    owner: string;\n    createdAt: ISODateString;\n}"
    },
    {
      "name": "FileMetadata",
      "kind": "type",
      "definition": "{\n    id:UUID\n    hash: HashString;\n    status: FileStatus;\n    name: string;\n    fileSize: number;\n    fileType: string;\n    compression: string;\n    owner: string;\n    createdAt: ISODateString;\n    chunksCount: number;\n    collectionId?: UUID;\n}"
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface FilesServiceRtClient {
  save(file: FileMetadata, processId?: string): UUID;
  saveChunk(chunk: FileChunk): HashString;
  update(id: UUID, file: FileMetadata): void;
  delete(id: UUID): void;
  get(id: UUID): FileMetadata;
  getChunks(id: UUID): FileChunk[];
  list(params: PaginationParams): PaginatedResult<FileMetadata>;
  statistic(): any;
  saveCollection(collection: FileCollection): UUID;
  getCollection(id: UUID): FileCollection;
  deleteCollection(id: UUID): void;
  listByCollection(collectionId: UUID): FileMetadata[];
}

export function createFilesServiceRtClient(): FilesServiceRtClient {
  return createRtClient<FilesServiceRtClient>(metadata);
}
