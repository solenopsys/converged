// Auto-generated package
import { createHttpClient } from "nrpc";



export const metadata = {
  "interfaceName": "SecretsService",
  "serviceName": "secrets",
  "filePath": "../types/secrets.ts",
  "methods": [
    {
      "name": "listSecrets",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
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
          "type": "Record",
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
      "name": "deleteSecret",
      "parameters": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": []
};

// Server interface (to be implemented in microservice)
export interface SecretsService {
  listSecrets(): Promise<any>;
  getSecret(name: string): Promise<any>;
  setSecret(name: string, data: Record): Promise<any>;
  deleteSecret(name: string): Promise<any>;
}

// Client interface
export interface SecretsServiceClient {
  listSecrets(): Promise<any>;
  getSecret(name: string): Promise<any>;
  setSecret(name: string, data: Record): Promise<any>;
  deleteSecret(name: string): Promise<any>;
}

// Factory function
export function createSecretsServiceClient(
  config?: { baseUrl?: string },
): SecretsServiceClient {
  return createHttpClient<SecretsServiceClient>(metadata, config);
}

// Ready-to-use client
export const secretsClient = createSecretsServiceClient();
