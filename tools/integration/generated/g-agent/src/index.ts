// Auto-generated package
import { createHttpClient } from "nrpc";

export type AgentStreamEvent = {
  tokens?: number;
} & (
  | { type: AgentStreamEventType.TEXT_DELTA; content: string }
  | { type: AgentStreamEventType.TOOL_CALL_START; id: string; name: string; args: any }
  | { type: AgentStreamEventType.TOOL_CALL_RESULT; id: string; name: string; result: string }
  | { type: AgentStreamEventType.ITERATION; iteration: number; maxIterations: number }
  | { type: AgentStreamEventType.COMPLETED; finishReason: string; totalIterations: number }
  | { type: AgentStreamEventType.ERROR; message: string }
);

export interface SessionInfo {
  id: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

export interface TokenUsage {
  total: number;
  input: number;
  output: number;
}

export const metadata = {
  "interfaceName": "AgentService",
  "serviceName": "agent",
  "filePath": "../types/agent.ts",
  "methods": [
    {
      "name": "createSession",
      "parameters": [
        {
          "name": "model",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "sendMessage",
      "parameters": [
        {
          "name": "sessionId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "content",
          "type": "string",
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
      "name": "getSession",
      "parameters": [
        {
          "name": "sessionId",
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
      "name": "listSessions",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
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
      "name": "deleteSession",
      "parameters": [
        {
          "name": "sessionId",
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
      "name": "listTools",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getStats",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "AgentStreamEvent",
      "definition": "{\n  tokens?: number;\n} & (\n  | { type: AgentStreamEventType.TEXT_DELTA; content: string }\n  | { type: AgentStreamEventType.TOOL_CALL_START; id: string; name: string; args: any }\n  | { type: AgentStreamEventType.TOOL_CALL_RESULT; id: string; name: string; result: string }\n  | { type: AgentStreamEventType.ITERATION; iteration: number; maxIterations: number }\n  | { type: AgentStreamEventType.COMPLETED; finishReason: string; totalIterations: number }\n  | { type: AgentStreamEventType.ERROR; message: string }\n)"
    },
    {
      "name": "SessionInfo",
      "definition": "",
      "properties": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "model",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "createdAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "updatedAt",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "messageCount",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "PaginationParams",
      "definition": "",
      "properties": [
        {
          "name": "offset",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "limit",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "PaginatedResult",
      "definition": "",
      "properties": [
        {
          "name": "items",
          "type": "T",
          "optional": false,
          "isArray": true
        },
        {
          "name": "totalCount",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "ToolDefinition",
      "definition": "",
      "properties": [
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "description",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "parameters",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "TokenUsage",
      "definition": "",
      "properties": [
        {
          "name": "total",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "input",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "output",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface AgentService {
  createSession(model?: string): Promise<any>;
  sendMessage(sessionId: string, content: string): AsyncIterable<any>;
  getSession(sessionId: string): Promise<any>;
  listSessions(params: PaginationParams): Promise<any>;
  deleteSession(sessionId: string): Promise<any>;
  listTools(): Promise<any>;
  getStats(): Promise<any>;
}

// Client interface
export interface AgentServiceClient {
  createSession(model?: string): Promise<any>;
  sendMessage(sessionId: string, content: string): AsyncIterable<any>;
  getSession(sessionId: string): Promise<any>;
  listSessions(params: PaginationParams): Promise<any>;
  deleteSession(sessionId: string): Promise<any>;
  listTools(): Promise<any>;
  getStats(): Promise<any>;
}

// Factory function
export function createAgentServiceClient(
  config?: { baseUrl?: string },
): AgentServiceClient {
  return createHttpClient<AgentServiceClient>(metadata, config);
}

// Ready-to-use client
export const agentClient = createAgentServiceClient();
