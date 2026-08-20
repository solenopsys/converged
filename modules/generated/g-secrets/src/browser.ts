// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";



export const metadata: ServiceMetadata = {
  "interfaceName": "SecretsService",
  "serviceName": "secrets",
  "filePath": "sequrity/secrets.ts",
  "methods": [
    {
      "name": "listSecrets",
      "parameters": [],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getSecret",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Record<string, string>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "setSecret",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "data",
          "type": "Record<string, string>",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteSecret",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": []
};

// Client interface
export interface SecretsServiceClient {
  listSecrets(): Promise<string[]>;
  getSecret(name: string): Promise<Record<string, string>>;
  setSecret(name: string, data: Record<string, string>): Promise<void>;
  deleteSecret(name: string): Promise<void>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createSecretsServiceClient(
  config: WebSocketClientConfig,
): SecretsServiceClient {
  return createWebSocketClient<SecretsServiceClient>(metadata, config);
}

export function createSecretsServiceWebSocketClient(
  config: WebSocketClientConfig,
): SecretsServiceClient {
  return createSecretsServiceClient(config);
}
