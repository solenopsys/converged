// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type OpenScadConvertInput = {
  sourceName: string;
  sourceData: Uint8Array;
};

export type OpenScadConvertResult = {
  fileName: string;
  fileData: Uint8Array;
  contentType: string;
};

const metadata: ServiceMetadata = {
  "interfaceName": "OpenScadConvertorService",
  "serviceName": "openscadconvertor",
  "filePath": "services/convertors/openscadconvertor.ts",
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface OpenScadConvertorServiceRtClient {
  convert(input: OpenScadConvertInput): OpenScadConvertResult;
}

export function createOpenScadConvertorServiceRtClient(): OpenScadConvertorServiceRtClient {
  return createRtClient<OpenScadConvertorServiceRtClient>(metadata);
}
