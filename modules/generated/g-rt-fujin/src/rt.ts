// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type FujinClientState = {
  id: number;
  scope: string;
};

export type FujinState = {
  websocketClients: FujinClientState[];
  peers: unknown;
};

export type FujinMessage = Record<string, unknown>;

export type FujinMessages = {
  stored: number;
  recorded: number;
  messages: FujinMessage[];
};

const metadata: ServiceMetadata = {
  "interfaceName": "RuntimeFujinService",
  "serviceName": "fujin",
  "filePath": "fujin.ts",
  "methods": [
    {
      "name": "state",
      "parameters": [],
      "returnType": "FujinState",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "messages",
      "parameters": [
        {
          "name": "limit",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "FujinMessages",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "logs",
      "parameters": [
        {
          "name": "limit",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "FujinMessages",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": true
    }
  ],
  "types": [
    {
      "name": "FujinClientState",
      "kind": "type",
      "definition": "{\n  id: number;\n  scope: string;\n}"
    },
    {
      "name": "FujinState",
      "kind": "type",
      "definition": "{\n  websocketClients: FujinClientState[];\n  peers: unknown;\n}"
    },
    {
      "name": "FujinMessage",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "FujinMessages",
      "kind": "type",
      "definition": "{\n  stored: number;\n  recorded: number;\n  messages: FujinMessage[];\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface RuntimeFujinServiceRtClient {
  state(): FujinState;
  messages(limit?: number): FujinMessages;
  logs(limit?: number): FujinMessages;
}

export function createRuntimeFujinServiceRtClient(): RuntimeFujinServiceRtClient {
  return createRtClient<RuntimeFujinServiceRtClient>(metadata);
}
