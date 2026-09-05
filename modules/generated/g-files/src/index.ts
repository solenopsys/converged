// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type HashString = string;

export type UUID = string;

export type ISODateString = string;

export type PaginationParams = {
	key?: string;
	offset: number;
	limit: number;
	filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type FileStatus = "uploading" | "uploaded" | "failed";

export type FileCollection = {
	id: UUID;
	name: string;
	description?: string;
	owner: string;
	createdAt: ISODateString;
};

export type FileMetadata = {
	id: UUID;
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
	fileId: UUID;
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
      "definition": "{\n\tkey?: string;\n\toffset: number;\n\tlimit: number;\n\tfilter?: FilterObject;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    },
    {
      "name": "FileStatus",
      "kind": "type",
      "definition": "\"uploading\" | \"uploaded\" | \"failed\""
    },
    {
      "name": "FileCollection",
      "kind": "type",
      "definition": "{\n\tid: UUID;\n\tname: string;\n\tdescription?: string;\n\towner: string;\n\tcreatedAt: ISODateString;\n}"
    },
    {
      "name": "FileMetadata",
      "kind": "type",
      "definition": "{\n\tid: UUID;\n\thash: HashString;\n\tstatus: FileStatus;\n\tname: string;\n\tfileSize: number;\n\tfileType: string;\n\tcompression: string;\n\towner: string;\n\tcreatedAt: ISODateString;\n\tchunksCount: number;\n\tcollectionId?: UUID;\n}"
    },
    {
      "name": "FileChunk",
      "kind": "type",
      "definition": "{\n\tfileId: UUID;\n\thash: HashString;\n\tchunkNumber: number;\n\tchunkSize: number;\n\tcreatedAt: ISODateString;\n}"
    },
    {
      "name": "FileStatistic",
      "kind": "type",
      "definition": "{\n\ttotalFiles: number;\n\ttotalChunks: number;\n\ttotalSize: number;\n\tcreatedAt: ISODateString;\n}"
    },
    {
      "name": "CacheRef",
      "kind": "type",
      "definition": "{\n\tcacheKey: string;\n\tsizeBytes?: number;\n}"
    },
    {
      "name": "MaterializedFile",
      "kind": "type",
      "definition": "{\n\tref: CacheRef;\n\tmetadata: FileMetadata;\n}"
    },
    {
      "name": "DetectTypeInput",
      "kind": "type",
      "definition": "{\n\tref: CacheRef;\n\tname: string;\n}"
    },
    {
      "name": "FileTypeDetection",
      "kind": "type",
      "definition": "{\n\ttype: string;\n\tmime: string;\n}"
    },
    {
      "name": "PersistInput",
      "kind": "type",
      "definition": "{\n\tref: CacheRef;\n\tname: string;\n\tfileType: string;\n\towner: string;\n\tcollectionId?: UUID;\n\tprocessId?: string;\n}"
    },
    {
      "name": "ExtractTextInput",
      "kind": "type",
      "definition": "{\n\tref: CacheRef;\n\tname: string;\n\t/** Cap on the returned text; 0 or omitted means no cap. */\n\tmaxChars?: number;\n}"
    },
    {
      "name": "ExtractTextResult",
      "kind": "type",
      "definition": "{\n\ttext: string;\n\t/** Length before the maxChars cap was applied. */\n\tchars: number;\n\ttruncated: boolean;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface FilesService {
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
  persist(input: PersistInput): Promise<FileMetadata>;
  extractText(input: ExtractTextInput): Promise<ExtractTextResult>;
}

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
  persist(input: PersistInput): Promise<FileMetadata>;
  extractText(input: ExtractTextInput): Promise<ExtractTextResult>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createFilesServiceClient(
  config: CrullerTransportClientConfig,
): FilesServiceClient {
  return createCrullerTransportClient<FilesServiceClient>(metadata, config);
}

export function createFilesServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): FilesServiceClient {
  return createFilesServiceClient(config);
}
