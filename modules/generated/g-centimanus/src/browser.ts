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
  "interfaceName": "CentimanusService",
  "serviceName": "centimanus",
  "filePath": "automation/centimanus.ts",
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
      "definition": "{\n\texecutionId: string;\n\tok: boolean;\n\tresult?: unknown;\n\terror?: string;\n}"
    }
  ]
};

// Client interface
export interface CentimanusServiceClient {
  runWorkflow(scriptPath: string, params: Record<string, unknown>): Promise<CentimanusWorkflowResult>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createCentimanusServiceClient(
  config: WebSocketClientConfig,
): CentimanusServiceClient {
  return createWebSocketClient<CentimanusServiceClient>(metadata, config);
}

export function createCentimanusServiceWebSocketClient(
  config: WebSocketClientConfig,
): CentimanusServiceClient {
  return createCentimanusServiceClient(config);
}
