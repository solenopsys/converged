// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
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

// Client interface
export interface RuntimeCentimanusServiceClient {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): Promise<CentimanusWorkflowResult>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createRuntimeCentimanusServiceClient(
  config: WebSocketClientConfig,
): RuntimeCentimanusServiceClient {
  return createWebSocketClient<RuntimeCentimanusServiceClient>(metadata, config);
}

export function createRuntimeCentimanusServiceWebSocketClient(
  config: WebSocketClientConfig,
): RuntimeCentimanusServiceClient {
  return createRuntimeCentimanusServiceClient(config);
}
