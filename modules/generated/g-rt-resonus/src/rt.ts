// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";



const metadata: ServiceMetadata = {
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface RuntimeResonusServiceRtClient {
  "call.offer"(payload: Record<string, unknown>): unknown;
  "call.hangup"(payload: Record<string, unknown>): unknown;
  "call.ice"(payload: Record<string, unknown>): unknown;
  "chat.message"(payload: Record<string, unknown>): unknown;
  "session.open"(payload: Record<string, unknown>): unknown;
  "session.bind"(payload: Record<string, unknown>): unknown;
  "session.close"(payload: Record<string, unknown>): unknown;
  "message.put"(payload: Record<string, unknown>): unknown;
  "context.create"(payload: Record<string, unknown>): unknown;
  "context.replace"(payload: Record<string, unknown>): unknown;
  "context.delete"(payload: Record<string, unknown>): unknown;
  "llm.generate"(payload: Record<string, unknown>): unknown;
  "dictation.start"(payload: Record<string, unknown>): unknown;
  "dictation.stop"(payload: Record<string, unknown>): unknown;
}

export function createRuntimeResonusServiceRtClient(): RuntimeResonusServiceRtClient {
  return createRtClient<RuntimeResonusServiceRtClient>(metadata);
}
