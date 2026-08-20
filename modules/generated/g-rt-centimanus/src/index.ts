// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type CentimanusWorkflowResult = {
  executionId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "RuntimeCentimanusService",
  "serviceName": "centimanus",
  "filePath": "centimanus.ts",
  "methods": [
    {
      "name": "runWorkflow",
      "parameters": [
        {
          "name": "scriptPath",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "CentimanusWorkflowResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "CentimanusWorkflowResult",
      "kind": "type",
      "definition": "{\n  executionId: string;\n  ok: boolean;\n  result?: unknown;\n  error?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface RuntimeCentimanusService {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): Promise<CentimanusWorkflowResult>;
}

// Client interface
export interface RuntimeCentimanusServiceClient {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): Promise<CentimanusWorkflowResult>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createRuntimeCentimanusServiceClient(
  config: CrullerTransportClientConfig,
): RuntimeCentimanusServiceClient {
  return createCrullerTransportClient<RuntimeCentimanusServiceClient>(metadata, config);
}

export function createRuntimeCentimanusServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): RuntimeCentimanusServiceClient {
  return createRuntimeCentimanusServiceClient(config);
}
