// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";



const metadata: ServiceMetadata = {
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface SecretsServiceRtClient {
  listSecrets(): string[];
  getSecret(name: string): Record<string, string>;
  setSecret(name: string, data: Record<string, string>): void;
  deleteSecret(name: string): void;
}

export function createSecretsServiceRtClient(): SecretsServiceRtClient {
  return createRtClient<SecretsServiceRtClient>(metadata);
}
