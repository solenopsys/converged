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
  "interfaceName": "FujinService",
  "serviceName": "fujin",
  "filePath": "platform/fujin.ts",
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
      "definition": "{\n\tid: number;\n\tscope: string;\n}"
    },
    {
      "name": "FujinState",
      "kind": "type",
      "definition": "{\n\twebsocketClients: FujinClientState[];\n\tpeers: unknown;\n}"
    },
    {
      "name": "FujinMessage",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "FujinMessages",
      "kind": "type",
      "definition": "{\n\tstored: number;\n\trecorded: number;\n\tmessages: FujinMessage[];\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface FujinServiceRtClient {
  state(): FujinState;
  messages(limit?: number): FujinMessages;
  logs(limit?: number): FujinMessages;
}

export function createFujinServiceRtClient(): FujinServiceRtClient {
  return createRtClient<FujinServiceRtClient>(metadata);
}
