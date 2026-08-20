// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
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

// Client interface
export interface RuntimeDagServiceClient {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): Promise<RuntimeWorkflowResult>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createRuntimeDagServiceClient(
  config: WebSocketClientConfig,
): RuntimeDagServiceClient {
  return createWebSocketClient<RuntimeDagServiceClient>(metadata, config);
}

export function createRuntimeDagServiceWebSocketClient(
  config: WebSocketClientConfig,
): RuntimeDagServiceClient {
  return createRuntimeDagServiceClient(config);
}
