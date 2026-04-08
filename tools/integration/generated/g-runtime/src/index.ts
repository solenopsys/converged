// Auto-generated package
import { createHttpClient } from "nrpc";



export const metadata = {
  "interfaceName": "RuntimeService",
  "serviceName": "runtime",
  "filePath": "../types/runtime.ts",
  "methods": [
    {
      "name": "startExecution",
      "parameters": [
        {
          "name": "workflowName",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "Record",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": true
    },
    {
      "name": "createExecution",
      "parameters": [
        {
          "name": "workflowName",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
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
      "name": "refreshCrons",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": []
};

// Server interface (to be implemented in microservice)
export interface RuntimeService {
  startExecution(workflowName: string, params: Record): AsyncIterable<any>;
  createExecution(workflowName: string, params: Record): Promise<any>;
  refreshCrons(): Promise<any>;
}

// Client interface
export interface RuntimeServiceClient {
  startExecution(workflowName: string, params: Record): AsyncIterable<any>;
  createExecution(workflowName: string, params: Record): Promise<any>;
  refreshCrons(): Promise<any>;
}

// Factory function
export function createRuntimeServiceClient(
  config?: { baseUrl?: string },
): RuntimeServiceClient {
  return createHttpClient<RuntimeServiceClient>(metadata, config);
}

// Ready-to-use client
export const runtimeClient = createRuntimeServiceClient();
