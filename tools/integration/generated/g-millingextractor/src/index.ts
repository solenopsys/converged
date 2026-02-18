// Auto-generated package
import { createHttpClient } from "nrpc";

export type MillingEstimateInput = {
  modelStl: Uint8Array;
  modelName?: string;
  toolDiameter?: number;
  toolLength?: number;
  stepover?: number;
  sampling?: number;
  minSampling?: number;
  feed?: number;
  rapid?: number;
  safeZ?: number;
  includeGcode?: boolean;
};

export type MillingEstimate = {
  triangles: number;
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  safeZ: number;
  passes: number;
  points: number;
  cutLengthMm: number;
  rapidLengthMm: number;
  cutTimeSec: number;
  rapidTimeSec: number;
  totalTimeSec: number;
};

export type MillingEstimateResult = {
  estimate: MillingEstimate;
  gcode?: Uint8Array;
};

export const metadata = {
  "interfaceName": "MillingExtractorService",
  "serviceName": "millingextractor",
  "filePath": "../types/millingextractor.ts",
  "methods": [
    {
      "name": "extract",
      "parameters": [
        {
          "name": "input",
          "type": "MillingEstimateInput",
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
      "name": "MillingEstimateInput",
      "definition": "{\n  modelStl: Uint8Array;\n  modelName?: string;\n  toolDiameter?: number;\n  toolLength?: number;\n  stepover?: number;\n  sampling?: number;\n  minSampling?: number;\n  feed?: number;\n  rapid?: number;\n  safeZ?: number;\n  includeGcode?: boolean;\n}"
    },
    {
      "name": "MillingEstimate",
      "definition": "{\n  triangles: number;\n  minX: number;\n  minY: number;\n  minZ: number;\n  maxX: number;\n  maxY: number;\n  maxZ: number;\n  safeZ: number;\n  passes: number;\n  points: number;\n  cutLengthMm: number;\n  rapidLengthMm: number;\n  cutTimeSec: number;\n  rapidTimeSec: number;\n  totalTimeSec: number;\n}"
    },
    {
      "name": "MillingEstimateResult",
      "definition": "{\n  estimate: MillingEstimate;\n  gcode?: Uint8Array;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface MillingExtractorService {
  extract(input: MillingEstimateInput): Promise<any>;
}

// Client interface
export interface MillingExtractorServiceClient {
  extract(input: MillingEstimateInput): Promise<any>;
}

// Factory function
export function createMillingExtractorServiceClient(
  config?: { baseUrl?: string },
): MillingExtractorServiceClient {
  return createHttpClient<MillingExtractorServiceClient>(metadata, config);
}

// Ready-to-use client
export const millingextractorClient = createMillingExtractorServiceClient();
