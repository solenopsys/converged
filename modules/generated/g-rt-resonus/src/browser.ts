// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";



export const metadata: ServiceMetadata = {
  "interfaceName": "RuntimeResonusService",
  "serviceName": "resonus",
  "filePath": "resonus.ts",
  "methods": [
    {
      "name": "call.offer",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "call.hangup",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "call.ice",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "chat.message",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "session.open",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "session.bind",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "session.close",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "message.put",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "context.create",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "context.replace",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "context.delete",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "llm.generate",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "dictation.start",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "unknown",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "dictation.stop",
      "parameters": [
        {
          "name": "payload",
          "type": "Record<string, unknown>",
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
  "types": []
};

// Client interface
export interface RuntimeResonusServiceClient {
  "call.offer"(payload: Record<string, unknown>): Promise<unknown>;
  "call.hangup"(payload: Record<string, unknown>): Promise<unknown>;
  "call.ice"(payload: Record<string, unknown>): Promise<unknown>;
  "chat.message"(payload: Record<string, unknown>): Promise<unknown>;
  "session.open"(payload: Record<string, unknown>): Promise<unknown>;
  "session.bind"(payload: Record<string, unknown>): Promise<unknown>;
  "session.close"(payload: Record<string, unknown>): Promise<unknown>;
  "message.put"(payload: Record<string, unknown>): Promise<unknown>;
  "context.create"(payload: Record<string, unknown>): Promise<unknown>;
  "context.replace"(payload: Record<string, unknown>): Promise<unknown>;
  "context.delete"(payload: Record<string, unknown>): Promise<unknown>;
  "llm.generate"(payload: Record<string, unknown>): Promise<unknown>;
  "dictation.start"(payload: Record<string, unknown>): Promise<unknown>;
  "dictation.stop"(payload: Record<string, unknown>): Promise<unknown>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createRuntimeResonusServiceClient(
  config: WebSocketClientConfig,
): RuntimeResonusServiceClient {
  return createWebSocketClient<RuntimeResonusServiceClient>(metadata, config);
}

export function createRuntimeResonusServiceWebSocketClient(
  config: WebSocketClientConfig,
): RuntimeResonusServiceClient {
  return createRuntimeResonusServiceClient(config);
}
