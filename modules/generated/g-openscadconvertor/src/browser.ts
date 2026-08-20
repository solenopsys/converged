// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type OpenScadConvertInput = {
  sourceName: string;
  sourceData: Uint8Array;
};

export type OpenScadConvertResult = {
  fileName: string;
  fileData: Uint8Array;
  contentType: string;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "OpenScadConvertorService",
  "serviceName": "openscadconvertor",
  "filePath": "convertors/openscadconvertor.ts",
  "methods": [
    {
      "name": "convert",
      "parameters": [
        {
          "name": "input",
          "type": "OpenScadConvertInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "OpenScadConvertResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "OpenScadConvertInput",
      "kind": "type",
      "definition": "{\n  sourceName: string;\n  sourceData: Uint8Array;\n}"
    },
    {
      "name": "OpenScadConvertResult",
      "kind": "type",
      "definition": "{\n  fileName: string;\n  fileData: Uint8Array;\n  contentType: string;\n}"
    }
  ]
};

// Client interface
export interface OpenScadConvertorServiceClient {
  convert(input: OpenScadConvertInput): Promise<OpenScadConvertResult>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createOpenScadConvertorServiceClient(
  config: WebSocketClientConfig,
): OpenScadConvertorServiceClient {
  return createWebSocketClient<OpenScadConvertorServiceClient>(metadata, config);
}

export function createOpenScadConvertorServiceWebSocketClient(
  config: WebSocketClientConfig,
): OpenScadConvertorServiceClient {
  return createOpenScadConvertorServiceClient(config);
}
