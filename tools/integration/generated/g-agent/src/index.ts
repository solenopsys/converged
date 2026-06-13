// Auto-generated package
import { createHttpClient, type ServiceMetadata } from "nrpc";

export enum AgentStreamEventType {
  TEXT_DELTA = "text_delta",
  TOOL_CALL_START = "tool_call_start",
  TOOL_CALL_RESULT = "tool_call_result",
  ITERATION = "iteration",
  COMPLETED = "completed",
  ERROR = "error",
}

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

export type SessionInfo = {
  id: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: any;
};

export type TokenUsage = {
  total: number;
  input: number;
  output: number;
};

export type MessageRole = "system" | "user" | "assistant" | "tool";

export type AgentMessage = {
  role: MessageRole;
  content: string;
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
  toolCallId?: string;
  name?: string;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "AgentService",
  "serviceName": "agent",
  "filePath": "services/ai/agent.ts",
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
      "returnType": "SessionInfo",
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
      "returnType": "AgentStreamEvent",
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
      "returnType": "SessionInfo",
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
      "returnType": "PaginatedResult<SessionInfo>",
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
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listTools",
      "parameters": [],
      "returnType": "ToolDefinition",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getStats",
      "parameters": [],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "appendMessage",
      "parameters": [
        {
          "name": "sessionId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "message",
          "type": "AgentMessage",
          "optional": false,
          "isArray": false
        },
        {
          "name": "tokenUsage",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getMessages",
      "parameters": [
        {
          "name": "sessionId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "limit",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "AgentMessage",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "updateTokenUsage",
      "parameters": [
        {
          "name": "sessionId",
          "type": "string",
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
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "AgentStreamEventType",
      "kind": "raw",
      "definition": "export enum AgentStreamEventType {\n  TEXT_DELTA = \"text_delta\",\n  TOOL_CALL_START = \"tool_call_start\",\n  TOOL_CALL_RESULT = \"tool_call_result\",\n  ITERATION = \"iteration\",\n  COMPLETED = \"completed\",\n  ERROR = \"error\",\n}"
    },
    {
      "name": "AgentStreamEvent",
      "kind": "type",
      "definition": "{\n  tokens?: number;\n} & (\n  | { type: AgentStreamEventType.TEXT_DELTA; content: string }\n  | { type: AgentStreamEventType.TOOL_CALL_START; id: string; name: string; args: any }\n  | { type: AgentStreamEventType.TOOL_CALL_RESULT; id: string; name: string; result: string }\n  | { type: AgentStreamEventType.ITERATION; iteration: number; maxIterations: number }\n  | { type: AgentStreamEventType.COMPLETED; finishReason: string; totalIterations: number }\n  | { type: AgentStreamEventType.ERROR; message: string }\n)"
    },
    {
      "name": "SessionInfo",
      "kind": "type",
      "definition": "{\n  id: string;\n  model: string;\n  createdAt: number;\n  updatedAt: number;\n  messageCount: number;\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "ToolDefinition",
      "kind": "type",
      "definition": "{\n  name: string;\n  description: string;\n  parameters: any;\n}"
    },
    {
      "name": "TokenUsage",
      "kind": "type",
      "definition": "{\n  total: number;\n  input: number;\n  output: number;\n}"
    },
    {
      "name": "MessageRole",
      "kind": "type",
      "definition": "\"system\" | \"user\" | \"assistant\" | \"tool\""
    },
    {
      "name": "AgentMessage",
      "kind": "type",
      "definition": "{\n  role: MessageRole;\n  content: string;\n  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];\n  toolCallId?: string;\n  name?: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface AgentService {
  createSession(model?: string): Promise<SessionInfo>;
  sendMessage(sessionId: string, content: string): AsyncIterable<AgentStreamEvent>;
  getSession(sessionId: string): Promise<SessionInfo>;
  listSessions(params: PaginationParams): Promise<PaginatedResult<SessionInfo>>;
  deleteSession(sessionId: string): Promise<void>;
  listTools(): Promise<ToolDefinition[]>;
  getStats(): Promise<any>;
  appendMessage(sessionId: string, message: AgentMessage, tokenUsage?: number): Promise<void>;
  getMessages(sessionId: string, limit: number): Promise<AgentMessage[]>;
  updateTokenUsage(sessionId: string, input: number, output: number): Promise<void>;
}

// Client interface
export interface AgentServiceClient {
  createSession(model?: string): Promise<SessionInfo>;
  sendMessage(sessionId: string, content: string): AsyncIterable<AgentStreamEvent>;
  getSession(sessionId: string): Promise<SessionInfo>;
  listSessions(params: PaginationParams): Promise<PaginatedResult<SessionInfo>>;
  deleteSession(sessionId: string): Promise<void>;
  listTools(): Promise<ToolDefinition[]>;
  getStats(): Promise<any>;
  appendMessage(sessionId: string, message: AgentMessage, tokenUsage?: number): Promise<void>;
  getMessages(sessionId: string, limit: number): Promise<AgentMessage[]>;
  updateTokenUsage(sessionId: string, input: number, output: number): Promise<void>;
}

// Factory function
export function createAgentServiceClient(
  config?: { baseUrl?: string },
): AgentServiceClient {
  return createHttpClient<AgentServiceClient>(metadata, config);
}

// Ready-to-use client
export const agentClient = createAgentServiceClient();
