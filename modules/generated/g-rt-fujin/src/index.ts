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

// Server interface (to be implemented in microservice)
export interface RuntimeFujinService {
  state(): Promise<FujinState>;
  messages(limit?: number): Promise<FujinMessages>;
  logs(limit?: number): AsyncIterable<FujinMessages>;
}

// Client interface
export interface RuntimeFujinServiceClient {
  state(): Promise<FujinState>;
  messages(limit?: number): Promise<FujinMessages>;
  logs(limit?: number): AsyncIterable<FujinMessages>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createRuntimeFujinServiceClient(
  config: CrullerTransportClientConfig,
): RuntimeFujinServiceClient {
  return createCrullerTransportClient<RuntimeFujinServiceClient>(metadata, config);
}

export function createRuntimeFujinServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): RuntimeFujinServiceClient {
  return createRuntimeFujinServiceClient(config);
}
