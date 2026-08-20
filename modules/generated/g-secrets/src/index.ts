// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
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

// Server interface (to be implemented in microservice)
export interface SecretsService {
  listSecrets(): Promise<string[]>;
  getSecret(name: string): Promise<Record<string, string>>;
  setSecret(name: string, data: Record<string, string>): Promise<void>;
  deleteSecret(name: string): Promise<void>;
}

// Client interface
export interface SecretsServiceClient {
  listSecrets(): Promise<string[]>;
  getSecret(name: string): Promise<Record<string, string>>;
  setSecret(name: string, data: Record<string, string>): Promise<void>;
  deleteSecret(name: string): Promise<void>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createSecretsServiceClient(
  config: CrullerTransportClientConfig,
): SecretsServiceClient {
  return createCrullerTransportClient<SecretsServiceClient>(metadata, config);
}

export function createSecretsServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): SecretsServiceClient {
  return createSecretsServiceClient(config);
}
