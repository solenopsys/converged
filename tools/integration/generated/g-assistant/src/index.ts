// Auto-generated package
import { createHttpClient } from "nrpc";

export type ContentBlock = {
    type: ContentType;
    data?: any;
};

export type ToolParameter = {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description: string;
    required?: boolean;
    enum?: (string | number)[];
    items?: ToolParameter;
    properties?: Record<string, ToolParameter>;
};

export type Tool = {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, ToolParameter>;
        required?: string[];
    };

    execute: (args: any) => Promise<any> | any;
};

export type ToolCall = {
    id: string;
    name: string;
    args: Record<string, any>;
};

export type ToolResult = {
    toolCallId: string;
    result: any;
    error?: string;
};

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

export type PaginationParams = {
    offset: number;
    limit: number;
};

export type PaginatedResult = {
    items: T[];
    totalCount?: number; // если хочешь знать общее число
};

export type Chat = {
    id: string;
    name: string;
    description: string;

};

export type ChatContextSummary = {
    id: string;
    chatId: string;
    updatedAt: number;
    size?: number;
};

export type ChatContext = ChatContextSummary & {
    data: any;
};

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
          "optional": true,
          "isArray": false
        },
        {
          "name": "model",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "string",
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
      "returnType": "StreamEvent",
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
      "returnType": "PaginatedResult",
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
      "returnType": "void",
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
      "returnType": "Chat",
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
      "returnType": "ChatContextSummary",
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
      "returnType": "PaginatedResult",
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
      "definition": "{\n    type: 'string' | 'number' | 'boolean' | 'object' | 'array';\n    description: string;\n    required?: boolean;\n    enum?: (string | number)[];\n    items?: ToolParameter;\n    properties?: Record<string, ToolParameter>;\n}"
    },
    {
      "name": "Tool",
      "definition": "{\n    name: string;\n    description: string;\n    parameters: {\n        type: 'object';\n        properties: Record<string, ToolParameter>;\n        required?: string[];\n    };\n\n    execute: (args: any) => Promise<any> | any;\n}"
    },
    {
      "name": "ToolCall",
      "definition": "{\n    id: string;\n    name: string;\n    args: Record<string, any>;\n}"
    },
    {
      "name": "ToolResult",
      "definition": "{\n    toolCallId: string;\n    result: any;\n    error?: string;\n}"
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
      "definition": "{\n    offset: number;\n    limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "definition": "{\n    items: T[];\n    totalCount?: number; // если хочешь знать общее число\n}"
    },
    {
      "name": "Chat",
      "definition": "{\n    id: string;\n    name: string;\n    description: string;\n\n}"
    },
    {
      "name": "ChatContextSummary",
      "definition": "{\n    id: string;\n    chatId: string;\n    updatedAt: number;\n    size?: number;\n}"
    },
    {
      "name": "ChatContext",
      "definition": "ChatContextSummary & {\n    data: any;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface AssistantService {
  createSession(serviceType?: ServiceType, model?: string): Promise<string>;
  sendMessage(sessionId: string, messages: ContentBlock[], options?: ConversationOptions): AsyncIterable<StreamEvent>;
  listOfChats(params: PaginationParams): Promise<PaginatedResult>;
  deleteChat(chatId: string): Promise<void>;
  getChat(chatId: string): Promise<Chat>;
  saveContext(chatId: string, context: any): Promise<ChatContextSummary>;
  getContext(chatId: string): Promise<any>;
  listContexts(params: PaginationParams): Promise<PaginatedResult>;
}

// Client interface
export interface AssistantServiceClient {
  createSession(serviceType?: ServiceType, model?: string): Promise<string>;
  sendMessage(sessionId: string, messages: ContentBlock[], options?: ConversationOptions): AsyncIterable<StreamEvent>;
  listOfChats(params: PaginationParams): Promise<PaginatedResult>;
  deleteChat(chatId: string): Promise<void>;
  getChat(chatId: string): Promise<Chat>;
  saveContext(chatId: string, context: any): Promise<ChatContextSummary>;
  getContext(chatId: string): Promise<any>;
  listContexts(params: PaginationParams): Promise<PaginatedResult>;
}

// Factory function
export function createAssistantServiceClient(
  config?: { baseUrl?: string },
): AssistantServiceClient {
  return createHttpClient<AssistantServiceClient>(metadata, config);
}

// Ready-to-use client
export const assistantClient = createAssistantServiceClient();
