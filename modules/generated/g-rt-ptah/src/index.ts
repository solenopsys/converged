// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type PtahTaskRequest = {
  plugin: string;
  task: Record<string, unknown>;
  inputs?: Record<string, string>;
  outputs?: string[];
};

export const metadata: ServiceMetadata = {
  "interfaceName": "RuntimePtahService",
  "serviceName": "ptah",
  "filePath": "ptah.ts",
  "methods": [
    {
      "name": "task.submit",
      "parameters": [
        {
          "name": "task",
          "type": "PtahTaskRequest",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "analyze",
      "parameters": [
        {
          "name": "task",
          "type": "PtahTaskRequest",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "PtahTaskRequest",
      "kind": "type",
      "definition": "{\n  plugin: string;\n  task: Record<string, unknown>;\n  inputs?: Record<string, string>;\n  outputs?: string[];\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface RuntimePtahService {
  "task.submit"(task: PtahTaskRequest): Promise<any>;
  analyze(task: PtahTaskRequest): Promise<unknown>;
}

// Client interface
export interface RuntimePtahServiceClient {
  "task.submit"(task: PtahTaskRequest): Promise<any>;
  analyze(task: PtahTaskRequest): Promise<unknown>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createRuntimePtahServiceClient(
  config: CrullerTransportClientConfig,
): RuntimePtahServiceClient {
  return createCrullerTransportClient<RuntimePtahServiceClient>(metadata, config);
}

export function createRuntimePtahServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): RuntimePtahServiceClient {
  return createRuntimePtahServiceClient(config);
}
