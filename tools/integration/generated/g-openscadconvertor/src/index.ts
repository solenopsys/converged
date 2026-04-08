// Auto-generated package
import { createHttpClient } from "nrpc";

export type OpenScadConvertInput = {
  sourceName: string;
  sourceData: Uint8Array;
};

export type OpenScadConvertResult = {
  fileName: string;
  fileData: Uint8Array;
  contentType: string;
};

export const metadata = {
  "interfaceName": "OpenScadConvertorService",
  "serviceName": "openscadconvertor",
  "filePath": "../types/openscadconvertor.ts",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "OpenScadConvertInput",
      "definition": "{\n  sourceName: string;\n  sourceData: Uint8Array;\n}"
    },
    {
      "name": "OpenScadConvertResult",
      "definition": "{\n  fileName: string;\n  fileData: Uint8Array;\n  contentType: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface OpenScadConvertorService {
  convert(input: OpenScadConvertInput): Promise<any>;
}

// Client interface
export interface OpenScadConvertorServiceClient {
  convert(input: OpenScadConvertInput): Promise<any>;
}

// Factory function
export function createOpenScadConvertorServiceClient(
  config?: { baseUrl?: string },
): OpenScadConvertorServiceClient {
  return createHttpClient<OpenScadConvertorServiceClient>(metadata, config);
}

// Ready-to-use client
export const openscadconvertorClient = createOpenScadConvertorServiceClient();
