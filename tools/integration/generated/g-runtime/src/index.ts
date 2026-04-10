// Auto-generated package
import { createHttpClient } from "nrpc";

export type ExecutionId = string;

export type ExecutionResult = {
  id: ExecutionId;
};

export type MagicLinkParams = {
  email: string;
  returnTo?: string;
  channel?: string;
  templateId?: string;
};

export type MagicLinkResult = {
  success: boolean;
};

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
      "returnType": "ExecutionEvent",
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
      "returnType": "ExecutionResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "refreshCrons",
      "parameters": [],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "sendMagicLink",
      "parameters": [
        {
          "name": "params",
          "type": "MagicLinkParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "MagicLinkResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ExecutionId",
      "definition": "string"
    },
    {
      "name": "ExecutionResult",
      "definition": "{\n  id: ExecutionId;\n}"
    },
    {
      "name": "MagicLinkParams",
      "definition": "{\n  email: string;\n  returnTo?: string;\n  channel?: string;\n  templateId?: string;\n}"
    },
    {
      "name": "MagicLinkResult",
      "definition": "{\n  success: boolean;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface RuntimeService {
  startExecution(workflowName: string, params: Record): AsyncIterable<ExecutionEvent>;
  createExecution(workflowName: string, params: Record): Promise<ExecutionResult>;
  refreshCrons(): Promise<void>;
  sendMagicLink(params: MagicLinkParams): Promise<MagicLinkResult>;
}

// Client interface
export interface RuntimeServiceClient {
  startExecution(workflowName: string, params: Record): AsyncIterable<ExecutionEvent>;
  createExecution(workflowName: string, params: Record): Promise<ExecutionResult>;
  refreshCrons(): Promise<void>;
  sendMagicLink(params: MagicLinkParams): Promise<MagicLinkResult>;
}

// Factory function
export function createRuntimeServiceClient(
  config?: { baseUrl?: string },
): RuntimeServiceClient {
  return createHttpClient<RuntimeServiceClient>(metadata, config);
}

// Ready-to-use client
export const runtimeClient = createRuntimeServiceClient();
