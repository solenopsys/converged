// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export interface RuntimeWorkflowResult {
  executionId: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export const metadata: ServiceMetadata = {
  "interfaceName": "RuntimeDagService",
  "serviceName": "dag",
  "filePath": "dag.ts",
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
      "returnType": "RuntimeWorkflowResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "RuntimeWorkflowResult",
      "definition": "",
      "kind": "interface",
      "properties": [
        {
          "name": "executionId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "ok",
          "type": "boolean",
          "optional": false,
          "isArray": false
        },
        {
          "name": "result",
          "type": "unknown",
          "optional": true,
          "isArray": false
        },
        {
          "name": "error",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface RuntimeDagService {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): Promise<RuntimeWorkflowResult>;
}

// Client interface
export interface RuntimeDagServiceClient {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): Promise<RuntimeWorkflowResult>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createRuntimeDagServiceClient(
  config: CrullerTransportClientConfig,
): RuntimeDagServiceClient {
  return createCrullerTransportClient<RuntimeDagServiceClient>(metadata, config);
}

export function createRuntimeDagServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): RuntimeDagServiceClient {
  return createRuntimeDagServiceClient(config);
}
