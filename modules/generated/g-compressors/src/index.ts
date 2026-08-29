// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type CompressionType = "none" | "deflate" | "gzip" | "brotli";

export type CacheRef = {
	cacheKey: string;
	sizeBytes?: number;
};

export type CompressedChunk = {
	ref: CacheRef;
	compression: CompressionType;
	originalSize: number;
};

export type ArchiveUnpackInput = {
	name: string;
	chunks: CompressedChunk[];
};

export type ProducedChunk = {
	ref: CacheRef;
	compression: CompressionType;
	originalSize: number;
};

export type UnpackedArchiveEntry = {
	name: string;
	fileType: string;
	hash: string;
	fileSize: number;
	chunks: ProducedChunk[];
};

export type ArchiveUnpackResult = {
	entries: UnpackedArchiveEntry[];
};

export const metadata: ServiceMetadata = {
  "interfaceName": "CompressorsService",
  "serviceName": "compressors",
  "filePath": "data/compressors.ts",
  "methods": [
    {
      "name": "unpack",
      "parameters": [
        {
          "name": "input",
          "type": "ArchiveUnpackInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ArchiveUnpackResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "CompressionType",
      "kind": "type",
      "definition": "\"none\" | \"deflate\" | \"gzip\" | \"brotli\""
    },
    {
      "name": "CacheRef",
      "kind": "type",
      "definition": "{\n\tcacheKey: string;\n\tsizeBytes?: number;\n}"
    },
    {
      "name": "CompressedChunk",
      "kind": "type",
      "definition": "{\n\tref: CacheRef;\n\tcompression: CompressionType;\n\toriginalSize: number;\n}"
    },
    {
      "name": "ArchiveUnpackInput",
      "kind": "type",
      "definition": "{\n\tname: string;\n\tchunks: CompressedChunk[];\n}"
    },
    {
      "name": "ProducedChunk",
      "kind": "type",
      "definition": "{\n\tref: CacheRef;\n\tcompression: CompressionType;\n\toriginalSize: number;\n}"
    },
    {
      "name": "UnpackedArchiveEntry",
      "kind": "type",
      "definition": "{\n\tname: string;\n\tfileType: string;\n\thash: string;\n\tfileSize: number;\n\tchunks: ProducedChunk[];\n}"
    },
    {
      "name": "ArchiveUnpackResult",
      "kind": "type",
      "definition": "{\n\tentries: UnpackedArchiveEntry[];\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface CompressorsService {
  unpack(input: ArchiveUnpackInput): Promise<ArchiveUnpackResult>;
}

// Client interface
export interface CompressorsServiceClient {
  unpack(input: ArchiveUnpackInput): Promise<ArchiveUnpackResult>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createCompressorsServiceClient(
  config: CrullerTransportClientConfig,
): CompressorsServiceClient {
  return createCrullerTransportClient<CompressorsServiceClient>(metadata, config);
}

export function createCompressorsServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): CompressorsServiceClient {
  return createCompressorsServiceClient(config);
}
