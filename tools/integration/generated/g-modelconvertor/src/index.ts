// Auto-generated package
import { createHttpClient } from "nrpc";

export type ConvertFormat = "assjson" | "gltf" | "gltf2" | "glb" | "glb2";

export type ModelConvertInput = {
  sourceName: string;
  sourceData: Uint8Array;
  format?: ConvertFormat;
};

export type ConvertedBinaryFile = {
  name: string;
  data: Uint8Array;
};

export type ModelConvertResult = {
  files: ConvertedBinaryFile[];
};

export const metadata = {
  "interfaceName": "ModelConvertorService",
  "serviceName": "modelconvertor",
  "filePath": "../types/modelconvertor.ts",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ConvertFormat",
      "definition": "\"assjson\" | \"gltf\" | \"gltf2\" | \"glb\" | \"glb2\""
    },
    {
      "name": "ModelConvertInput",
      "definition": "{\n  sourceName: string;\n  sourceData: Uint8Array;\n  format?: ConvertFormat;\n}"
    },
    {
      "name": "ConvertedBinaryFile",
      "definition": "{\n  name: string;\n  data: Uint8Array;\n}"
    },
    {
      "name": "ModelConvertResult",
      "definition": "{\n  files: ConvertedBinaryFile[];\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ModelConvertorService {
  convert(input: ModelConvertInput): Promise<any>;
}

// Client interface
export interface ModelConvertorServiceClient {
  convert(input: ModelConvertInput): Promise<any>;
}

// Factory function
export function createModelConvertorServiceClient(
  config?: { baseUrl?: string },
): ModelConvertorServiceClient {
  return createHttpClient<ModelConvertorServiceClient>(metadata, config);
}

// Ready-to-use client
export const modelconvertorClient = createModelConvertorServiceClient();
