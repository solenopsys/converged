// Auto-generated frontend client
import { createHttpClient } from 'nrpc';



const metadata = {
  "interfaceName": "ModulesService",
  "serviceName": "modules",
  "filePath": "/home/alexstorm/distrib/4ir/CONVERGED/public/types/modules.ts",
  "methods": [
    {
      "name": "list",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "add",
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
      "name": "remove",
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

// Service client interface
export interface ModulesServiceClient {
  list(): Promise<any>;
  add(name: string): Promise<any>;
  remove(name: string): Promise<any>;
}

// Factory function
export function createModulesServiceClient(config?: { baseUrl?: string }): ModulesServiceClient {
  return createHttpClient<ModulesServiceClient>(metadata, config);
}

// Export ready-to-use client
export const modulesClient = createModulesServiceClient();
