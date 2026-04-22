// Auto-generated package
import { createHttpClient } from "nrpc";

export type NamedBinaryFile = {
  name: string;
  data: Uint8Array;
};

export type SliceEstimateInput = {
  modelStl: Uint8Array;
  modelName?: string;
  definitionJson: Uint8Array;
  definitionName?: string;
  searchFiles?: NamedBinaryFile[];
  settings?: string[];
  density?: number;
  filamentDiameter?: number;
  threads?: number;
};

export type GcodeEstimateInput = {
  gcode: Uint8Array;
  density?: number;
  filamentDiameter?: number;
};

export type PrintEstimate = {
  timeSeconds?: number;
  filamentLengthMeters?: number;
  materialVolumeMm3?: number;
  weightGrams?: number;
};

export type SliceEstimateResult = {
  estimate: PrintEstimate;
  gcode: Uint8Array;
};

export const metadata = {
  "interfaceName": "PrintExtractorService",
  "serviceName": "printextractor",
  "filePath": "services/extractors/printextractor.ts",
  "methods": [
    {
      "name": "extractFromSlice",
      "parameters": [
        {
          "name": "input",
          "type": "SliceEstimateInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "SliceEstimateResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "extractFromGcode",
      "parameters": [
        {
          "name": "input",
          "type": "GcodeEstimateInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PrintEstimate",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "NamedBinaryFile",
      "kind": "type",
      "definition": "{\n  name: string;\n  data: Uint8Array;\n}"
    },
    {
      "name": "SliceEstimateInput",
      "kind": "type",
      "definition": "{\n  modelStl: Uint8Array;\n  modelName?: string;\n  definitionJson: Uint8Array;\n  definitionName?: string;\n  searchFiles?: NamedBinaryFile[];\n  settings?: string[];\n  density?: number;\n  filamentDiameter?: number;\n  threads?: number;\n}"
    },
    {
      "name": "GcodeEstimateInput",
      "kind": "type",
      "definition": "{\n  gcode: Uint8Array;\n  density?: number;\n  filamentDiameter?: number;\n}"
    },
    {
      "name": "PrintEstimate",
      "kind": "type",
      "definition": "{\n  timeSeconds?: number;\n  filamentLengthMeters?: number;\n  materialVolumeMm3?: number;\n  weightGrams?: number;\n}"
    },
    {
      "name": "SliceEstimateResult",
      "kind": "type",
      "definition": "{\n  estimate: PrintEstimate;\n  gcode: Uint8Array;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface PrintExtractorService {
  extractFromSlice(input: SliceEstimateInput): Promise<SliceEstimateResult>;
  extractFromGcode(input: GcodeEstimateInput): Promise<PrintEstimate>;
}

// Client interface
export interface PrintExtractorServiceClient {
  extractFromSlice(input: SliceEstimateInput): Promise<SliceEstimateResult>;
  extractFromGcode(input: GcodeEstimateInput): Promise<PrintEstimate>;
}

// Factory function
export function createPrintExtractorServiceClient(
  config?: { baseUrl?: string },
): PrintExtractorServiceClient {
  return createHttpClient<PrintExtractorServiceClient>(metadata, config);
}

// Ready-to-use client
export const printextractorClient = createPrintExtractorServiceClient();
