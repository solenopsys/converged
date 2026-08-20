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
