// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type ConvertFormat = "assjson" | "gltf" | "gltf2" | "glb" | "glb2";

export type CacheRef = {
	cacheKey: string;
	sizeBytes?: number;
};

export type ModelConvertInput = {
	/**
	 * The stored file to convert. The service reads its fragments itself — that
	 * is what ms-files and ms-store are for — so a caller that has an id never
	 * has to move bytes or assemble chunks to get a preview.
	 */
	fileId: string;
	/** Overrides the stored name; the extension decides the source parser. */
	sourceName?: string;
	format?: ConvertFormat;
};

export type ConvertedFileRef = {
	name: string;
	ref: CacheRef;
};

export type ModelConvertResult = {
	files: ConvertedFileRef[];
};

export const metadata: ServiceMetadata = {
  "interfaceName": "ModelConvertorService",
  "serviceName": "modelconvertor",
  "filePath": "convertors/modelconvertor.ts",
  "methods": [
    {
      "name": "convert",
      "parameters": [
        {
          "name": "input",
          "type": "ModelConvertInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ModelConvertResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ConvertFormat",
      "kind": "type",
      "definition": "\"assjson\" | \"gltf\" | \"gltf2\" | \"glb\" | \"glb2\""
    },
    {
      "name": "CacheRef",
      "kind": "type",
      "definition": "{\n\tcacheKey: string;\n\tsizeBytes?: number;\n}"
    },
    {
      "name": "ModelConvertInput",
      "kind": "type",
      "definition": "{\n\t/**\n\t * The stored file to convert. The service reads its fragments itself — that\n\t * is what ms-files and ms-store are for — so a caller that has an id never\n\t * has to move bytes or assemble chunks to get a preview.\n\t */\n\tfileId: string;\n\t/** Overrides the stored name; the extension decides the source parser. */\n\tsourceName?: string;\n\tformat?: ConvertFormat;\n}"
    },
    {
      "name": "ConvertedFileRef",
      "kind": "type",
      "definition": "{\n\tname: string;\n\tref: CacheRef;\n}"
    },
    {
      "name": "ModelConvertResult",
      "kind": "type",
      "definition": "{\n\tfiles: ConvertedFileRef[];\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ModelConvertorService {
  convert(input: ModelConvertInput): Promise<ModelConvertResult>;
}

// Client interface
export interface ModelConvertorServiceClient {
  convert(input: ModelConvertInput): Promise<ModelConvertResult>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createModelConvertorServiceClient(
  config: CrullerTransportClientConfig,
): ModelConvertorServiceClient {
  return createCrullerTransportClient<ModelConvertorServiceClient>(metadata, config);
}

export function createModelConvertorServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): ModelConvertorServiceClient {
  return createModelConvertorServiceClient(config);
}
