// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type ConvertFormat = "assjson" | "gltf" | "gltf2" | "glb" | "glb2";

export type CacheRef = {
	cacheKey: string;
	sizeBytes?: number;
};

export type ModelConvertInput = {
	/**
	 * The stored file to convert. The service reads its fragments itself — that
	 * is what rp-files and rp-store are for — so a caller that has an id never
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

const metadata: ServiceMetadata = {
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
      "definition": "{\n\t/**\n\t * The stored file to convert. The service reads its fragments itself — that\n\t * is what rp-files and rp-store are for — so a caller that has an id never\n\t * has to move bytes or assemble chunks to get a preview.\n\t */\n\tfileId: string;\n\t/** Overrides the stored name; the extension decides the source parser. */\n\tsourceName?: string;\n\tformat?: ConvertFormat;\n}"
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface ModelConvertorServiceRtClient {
  convert(input: ModelConvertInput): ModelConvertResult;
}

export function createModelConvertorServiceRtClient(): ModelConvertorServiceRtClient {
  return createRtClient<ModelConvertorServiceRtClient>(metadata);
}
