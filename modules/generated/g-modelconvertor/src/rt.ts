// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type ConvertFormat = "assjson" | "gltf" | "gltf2" | "glb" | "glb2";

export type CacheRef = {
  cacheKey: string;
  sizeBytes?: number;
};

export type ModelConvertInput = {
  sourceRef: CacheRef;
  sourceName: string;
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
      "definition": "{\n  cacheKey: string;\n  sizeBytes?: number;\n}"
    },
    {
      "name": "ModelConvertInput",
      "kind": "type",
      "definition": "{\n  sourceRef: CacheRef;\n  sourceName: string;\n  format?: ConvertFormat;\n}"
    },
    {
      "name": "ConvertedFileRef",
      "kind": "type",
      "definition": "{\n  name: string;\n  ref: CacheRef;\n}"
    },
    {
      "name": "ModelConvertResult",
      "kind": "type",
      "definition": "{\n  files: ConvertedFileRef[];\n}"
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
