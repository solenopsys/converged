// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
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

// Client interface
export interface RuntimePtahServiceClient {
  "task.submit"(task: PtahTaskRequest): Promise<any>;
  analyze(task: PtahTaskRequest): Promise<unknown>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createRuntimePtahServiceClient(
  config: WebSocketClientConfig,
): RuntimePtahServiceClient {
  return createWebSocketClient<RuntimePtahServiceClient>(metadata, config);
}

export function createRuntimePtahServiceWebSocketClient(
  config: WebSocketClientConfig,
): RuntimePtahServiceClient {
  return createRuntimePtahServiceClient(config);
}
