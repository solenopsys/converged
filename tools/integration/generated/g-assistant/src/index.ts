// Auto-generated package
import { createHttpClient } from "nrpc";

export type ContentBlock = {
    type: ContentType;
    data?: any;
};

export interface ToolParameter {
  type: any;
  description: string;
  required?: boolean;
  enum?: any[];
  items?: ToolParameter;
  properties?: Record;
}

export interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: any;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record;
}

export interface ToolResult {
  toolCallId: string;
  result: any;
  error?: string;
}

export type ConversationOptions = {
    stream?: boolean;
    tools?: Tool[];
    temperature?: number;
    maxTokens?: number;
};

export type StreamEvent = {
    tokens?: number;
} & (
    | { type: StreamEventType.TEXT_DELTA; content: string }
    | { type: StreamEventType.TOOL_CALL; id: string; name: string; args: any }
    | { type: StreamEventType.COMPLETED; finishReason?: string }
    | { type: StreamEventType.ERROR; message: string }
);

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult {
  items: T[];
  totalCount?: number;
}

export interface Chat {
  id: string;
  name: string;
  description: string;
}

export interface ChatContextSummary {
  id: string;
  chatId: string;
  updatedAt: number;
  size?: number;
}

export interface ChatContext {
  data: any;
}

export const metadata = {
  "interfaceName": "AssistantService",
  "serviceName": "assistant",
  "filePath": "../types/chats.ts",
  "methods": [
    {
      "name": "createSession",
      "parameters": [
        {
          "name": "serviceType",
          "type": "ServiceType",
          "optional": false,
          "isArray": false
        },
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
          "name": "messages",
          "type": "ContentBlock",
          "optional": false,
          "isArray": true
        },
        {
          "name": "options",
          "type": "ConversationOptions",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": true
    },
    {
      "name": "listOfChats",
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
      "name": "deleteChat",
      "parameters": [
        {
          "name": "chatId",
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
      "name": "getChat",
      "parameters": [
        {
          "name": "chatId",
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
      "name": "saveContext",
      "parameters": [
        {
          "name": "chatId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "context",
          "type": "any",
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
      "name": "getContext",
      "parameters": [
        {
          "name": "chatId",
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
      "name": "listContexts",
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
    }
  ],
  "types": [
    {
      "name": "ContentBlock",
      "definition": "{\n    type: ContentType;\n    data?: any;\n}"
    },
    {
      "name": "ToolParameter",
      "definition": "",
      "properties": [
        {
          "name": "type",
          "type": "any",
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
          "name": "required",
          "type": "boolean",
          "optional": true,
          "isArray": false
        },
        {
          "name": "enum",
          "type": "any",
          "optional": true,
          "isArray": true
        },
        {
          "name": "items",
          "type": "ToolParameter",
          "optional": true,
          "isArray": false
        },
        {
          "name": "properties",
          "type": "Record",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "Tool",
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
        },
        {
          "name": "execute",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "ToolCall",
      "definition": "",
      "properties": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "name",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "args",
          "type": "Record",
          "optional": false,
          "isArray": false
        }
      ]
    },
    {
      "name": "ToolResult",
      "definition": "",
      "properties": [
        {
          "name": "toolCallId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "result",
          "type": "any",
          "optional": false,
          "isArray": false
        },
        {
          "name": "error",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "ConversationOptions",
      "definition": "{\n    stream?: boolean;\n    tools?: Tool[];\n    temperature?: number;\n    maxTokens?: number;\n}"
    },
    {
      "name": "StreamEvent",
      "definition": "{\n    tokens?: number;\n} & (\n    | { type: StreamEventType.TEXT_DELTA; content: string }\n    | { type: StreamEventType.TOOL_CALL; id: string; name: string; args: any }\n    | { type: StreamEventType.COMPLETED; finishReason?: string }\n    | { type: StreamEventType.ERROR; message: string }\n)"
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
      "name": "Chat",
      "definition": "",
      "properties": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
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
        }
      ]
    },
    {
      "name": "ChatContextSummary",
      "definition": "",
      "properties": [
        {
          "name": "id",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "chatId",
          "type": "string",
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
          "name": "size",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ]
    },
    {
      "name": "ChatContext",
      "definition": "",
      "properties": [
        {
          "name": "data",
          "type": "any",
          "optional": false,
          "isArray": false
        }
      ]
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface AssistantService {
  createSession(serviceType: ServiceType, model?: string): Promise<any>;
  sendMessage(sessionId: string, messages: ContentBlock[], options?: ConversationOptions): AsyncIterable<any>;
  listOfChats(params: PaginationParams): Promise<any>;
  deleteChat(chatId: string): Promise<any>;
  getChat(chatId: string): Promise<any>;
  saveContext(chatId: string, context: any): Promise<any>;
  getContext(chatId: string): Promise<any>;
  listContexts(params: PaginationParams): Promise<any>;
}

// Client interface
export interface AssistantServiceClient {
  createSession(serviceType: ServiceType, model?: string): Promise<any>;
  sendMessage(sessionId: string, messages: ContentBlock[], options?: ConversationOptions): AsyncIterable<any>;
  listOfChats(params: PaginationParams): Promise<any>;
  deleteChat(chatId: string): Promise<any>;
  getChat(chatId: string): Promise<any>;
  saveContext(chatId: string, context: any): Promise<any>;
  getContext(chatId: string): Promise<any>;
  listContexts(params: PaginationParams): Promise<any>;
}

// Factory function
export function createAssistantServiceClient(
  config?: { baseUrl?: string },
): AssistantServiceClient {
  return createHttpClient<AssistantServiceClient>(metadata, config);
}

// Ready-to-use client
export const assistantClient = createAssistantServiceClient();
