// Auto-generated package
import { createHttpClient } from "nrpc";



export const metadata = {
  "interfaceName": "SecretsService",
  "serviceName": "secrets",
  "filePath": "services/sequrity/secrets.ts",
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

// Factory function
export function createSecretsServiceClient(
  config?: { baseUrl?: string },
): SecretsServiceClient {
  return createHttpClient<SecretsServiceClient>(metadata, config);
}

// Ready-to-use client
export const secretsClient = createSecretsServiceClient();
