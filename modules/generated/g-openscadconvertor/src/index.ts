// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
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

// Server interface (to be implemented in microservice)
export interface OpenScadConvertorService {
  convert(input: OpenScadConvertInput): Promise<OpenScadConvertResult>;
}

// Client interface
export interface OpenScadConvertorServiceClient {
  convert(input: OpenScadConvertInput): Promise<OpenScadConvertResult>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createOpenScadConvertorServiceClient(
  config: CrullerTransportClientConfig,
): OpenScadConvertorServiceClient {
  return createCrullerTransportClient<OpenScadConvertorServiceClient>(metadata, config);
}

export function createOpenScadConvertorServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): OpenScadConvertorServiceClient {
  return createOpenScadConvertorServiceClient(config);
}
