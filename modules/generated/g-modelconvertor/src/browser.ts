// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
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
      "definition": "{\n  cacheKey: string;\n  sizeBytes?: number;\n}"
    },
    {
      "name": "ModelConvertInput",
      "kind": "type",
      "definition": "{\n  /**\n   * The stored file to convert. The service reads its fragments itself — that\n   * is what ms-files and ms-store are for — so a caller that has an id never\n   * has to move bytes or assemble chunks to get a preview.\n   */\n  fileId: string;\n  /** Overrides the stored name; the extension decides the source parser. */\n  sourceName?: string;\n  format?: ConvertFormat;\n}"
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

// Client interface
export interface ModelConvertorServiceClient {
  convert(input: ModelConvertInput): Promise<ModelConvertResult>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createModelConvertorServiceClient(
  config: WebSocketClientConfig,
): ModelConvertorServiceClient {
  return createWebSocketClient<ModelConvertorServiceClient>(metadata, config);
}

export function createModelConvertorServiceWebSocketClient(
  config: WebSocketClientConfig,
): ModelConvertorServiceClient {
  return createModelConvertorServiceClient(config);
}
