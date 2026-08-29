// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

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

export const metadata: ServiceMetadata = {
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

// Server interface (to be implemented in microservice)
export interface FujinService {
  state(): Promise<FujinState>;
  messages(limit?: number): Promise<FujinMessages>;
  logs(limit?: number): AsyncIterable<FujinMessages>;
}

// Client interface
export interface FujinServiceClient {
  state(): Promise<FujinState>;
  messages(limit?: number): Promise<FujinMessages>;
  logs(limit?: number): AsyncIterable<FujinMessages>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createFujinServiceClient(
  config: CrullerTransportClientConfig,
): FujinServiceClient {
  return createCrullerTransportClient<FujinServiceClient>(metadata, config);
}

export function createFujinServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): FujinServiceClient {
  return createFujinServiceClient(config);
}
