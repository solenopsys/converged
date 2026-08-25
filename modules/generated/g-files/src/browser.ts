// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

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

export type CacheRef = {
    cacheKey: string;
    sizeBytes?: number;
};

export type MaterializedFile = {
    ref: CacheRef;
    metadata: FileMetadata;
};

export type DetectTypeInput = {
    ref: CacheRef;
    name: string;
};

export type FileTypeDetection = {
    type: string;
    mime: string;
};

export type UnzipInput = {
    ref: CacheRef;
    collectionId: UUID;
    owner: string;
    processId?: string;
};

export type UnzipEntry = {
    fileId: UUID;
    name: string;
};

export type UnzipResult = {
    entries: UnzipEntry[];
};

export type PersistInput = {
    ref: CacheRef;
    name: string;
    fileType: string;
    owner: string;
    collectionId?: UUID;
    processId?: string;
};

export type ExtractTextInput = {
    ref: CacheRef;
    name: string;
    /** Cap on the returned text; 0 or omitted means no cap. */
    maxChars?: number;
};

export type ExtractTextResult = {
    text: string;
    /** Length before the maxChars cap was applied. */
    chars: number;
    truncated: boolean;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "FilesService",
  "serviceName": "files",
  "filePath": "data/files.ts",
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
    },
    {
      "name": "materialize",
      "parameters": [
        {
          "name": "fileId",
          "type": "UUID",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "MaterializedFile",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "detectType",
      "parameters": [
        {
          "name": "input",
          "type": "DetectTypeInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "FileTypeDetection",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "unzip",
      "parameters": [
        {
          "name": "input",
          "type": "UnzipInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "UnzipResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "persist",
      "parameters": [
        {
          "name": "input",
          "type": "PersistInput",
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
      "name": "extractText",
      "parameters": [
        {
          "name": "input",
          "type": "ExtractTextInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ExtractTextResult",
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
    },
    {
      "name": "CacheRef",
      "kind": "type",
      "definition": "{\n    cacheKey: string;\n    sizeBytes?: number;\n}"
    },
    {
      "name": "MaterializedFile",
      "kind": "type",
      "definition": "{\n    ref: CacheRef;\n    metadata: FileMetadata;\n}"
    },
    {
      "name": "DetectTypeInput",
      "kind": "type",
      "definition": "{\n    ref: CacheRef;\n    name: string;\n}"
    },
    {
      "name": "FileTypeDetection",
      "kind": "type",
      "definition": "{\n    type: string;\n    mime: string;\n}"
    },
    {
      "name": "UnzipInput",
      "kind": "type",
      "definition": "{\n    ref: CacheRef;\n    collectionId: UUID;\n    owner: string;\n    processId?: string;\n}"
    },
    {
      "name": "UnzipEntry",
      "kind": "type",
      "definition": "{\n    fileId: UUID;\n    name: string;\n}"
    },
    {
      "name": "UnzipResult",
      "kind": "type",
      "definition": "{\n    entries: UnzipEntry[];\n}"
    },
    {
      "name": "PersistInput",
      "kind": "type",
      "definition": "{\n    ref: CacheRef;\n    name: string;\n    fileType: string;\n    owner: string;\n    collectionId?: UUID;\n    processId?: string;\n}"
    },
    {
      "name": "ExtractTextInput",
      "kind": "type",
      "definition": "{\n    ref: CacheRef;\n    name: string;\n    /** Cap on the returned text; 0 or omitted means no cap. */\n    maxChars?: number;\n}"
    },
    {
      "name": "ExtractTextResult",
      "kind": "type",
      "definition": "{\n    text: string;\n    /** Length before the maxChars cap was applied. */\n    chars: number;\n    truncated: boolean;\n}"
    }
  ]
};

// Client interface
export interface FilesServiceClient {
  save(file: FileMetadata, processId?: string): Promise<UUID>;
  saveChunk(chunk: FileChunk): Promise<HashString>;
  update(id: UUID, file: FileMetadata): Promise<void>;
  delete(id: UUID): Promise<void>;
  get(id: UUID): Promise<FileMetadata>;
  getChunks(id: UUID): Promise<FileChunk[]>;
  list(params: PaginationParams): Promise<PaginatedResult<FileMetadata>>;
  statistic(): Promise<any>;
  saveCollection(collection: FileCollection): Promise<UUID>;
  getCollection(id: UUID): Promise<FileCollection>;
  deleteCollection(id: UUID): Promise<void>;
  listByCollection(collectionId: UUID): Promise<FileMetadata[]>;
  materialize(fileId: UUID): Promise<MaterializedFile>;
  detectType(input: DetectTypeInput): Promise<FileTypeDetection>;
  unzip(input: UnzipInput): Promise<UnzipResult>;
  persist(input: PersistInput): Promise<FileMetadata>;
  extractText(input: ExtractTextInput): Promise<ExtractTextResult>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createFilesServiceClient(
  config: WebSocketClientConfig,
): FilesServiceClient {
  return createWebSocketClient<FilesServiceClient>(metadata, config);
}

export function createFilesServiceWebSocketClient(
  config: WebSocketClientConfig,
): FilesServiceClient {
  return createFilesServiceClient(config);
}
