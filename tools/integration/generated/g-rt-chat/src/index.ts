// Auto-generated package
import { createHttpClient } from "nrpc";

export enum StreamEventType {
    TEXT_DELTA = "text_delta",
    TOOL_CALL = "tool_call",
    COMPLETED = "completed",
    TOOL_CALL_DELTA = "tool_call_delta",  // Новый тип для частичных данных инструментов

    ERROR = "error"
}

export enum ServiceType {
    OPENAI = "openai",
    ANTHROPIC = "anthropic",
    GEMINI = "gemini"
}

export enum ContentType {
    TEXT = "text",
    TOOL_RESULT = "tool_result",
    ATTACHMENT = "attachment"
}

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

export enum MessageSource {
    USER = "user",
    ASSISTANT = "assistant"
}

export type PaginationParams = {
    offset: number;
    limit: number;
};

export type PaginatedResult<T> = {
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
  "interfaceName": "RuntimeChatService",
  "serviceName": "chat",
  "packageName": "g-rt-chat",
  "filePath": "runtime/ai/chat.ts",
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
      "returnType": "PaginatedResult<Chat>",
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
      "returnType": "ChatContext | any",
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
      "returnType": "PaginatedResult<ChatContextSummary>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "StreamEventType",
      "kind": "raw",
      "definition": "export enum StreamEventType {\n    TEXT_DELTA = \"text_delta\",\n    TOOL_CALL = \"tool_call\",\n    COMPLETED = \"completed\",\n    TOOL_CALL_DELTA = \"tool_call_delta\",  // Новый тип для частичных данных инструментов\n\n    ERROR = \"error\"\n}"
    },
    {
      "name": "ServiceType",
      "kind": "raw",
      "definition": "export enum ServiceType {\n    OPENAI = \"openai\",\n    ANTHROPIC = \"anthropic\",\n    GEMINI = \"gemini\"\n}"
    },
    {
      "name": "ContentType",
      "kind": "raw",
      "definition": "export enum ContentType {\n    TEXT = \"text\",\n    TOOL_RESULT = \"tool_result\",\n    ATTACHMENT = \"attachment\"\n}"
    },
    {
      "name": "ContentBlock",
      "kind": "type",
      "definition": "{\n    type: ContentType;\n    data?: any;\n}"
    },
    {
      "name": "ToolParameter",
      "kind": "type",
      "definition": "{\n    type: 'string' | 'number' | 'boolean' | 'object' | 'array';\n    description: string;\n    required?: boolean;\n    enum?: (string | number)[];\n    items?: ToolParameter;\n    properties?: Record<string, ToolParameter>;\n}"
    },
    {
      "name": "Tool",
      "kind": "type",
      "definition": "{\n    name: string;\n    description: string;\n    parameters: {\n        type: 'object';\n        properties: Record<string, ToolParameter>;\n        required?: string[];\n    };\n\n    execute: (args: any) => Promise<any> | any;\n}"
    },
    {
      "name": "ToolCall",
      "kind": "type",
      "definition": "{\n    id: string;\n    name: string;\n    args: Record<string, any>;\n}"
    },
    {
      "name": "ToolResult",
      "kind": "type",
      "definition": "{\n    toolCallId: string;\n    result: any;\n    error?: string;\n}"
    },
    {
      "name": "ConversationOptions",
      "kind": "type",
      "definition": "{\n    stream?: boolean;\n    tools?: Tool[];\n    temperature?: number;\n    maxTokens?: number;\n}"
    },
    {
      "name": "StreamEvent",
      "kind": "type",
      "definition": "{\n    tokens?: number;\n} & (\n    | { type: StreamEventType.TEXT_DELTA; content: string }\n    | { type: StreamEventType.TOOL_CALL; id: string; name: string; args: any }\n    | { type: StreamEventType.COMPLETED; finishReason?: string }\n    | { type: StreamEventType.ERROR; message: string }\n)"
    },
    {
      "name": "MessageSource",
      "kind": "raw",
      "definition": "export enum MessageSource {\n    USER = \"user\",\n    ASSISTANT = \"assistant\"\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n    offset: number;\n    limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n    items: T[];\n    totalCount?: number; // если хочешь знать общее число\n}"
    },
    {
      "name": "Chat",
      "kind": "type",
      "definition": "{\n    id: string;\n    name: string;\n    description: string;\n\n}"
    },
    {
      "name": "ChatContextSummary",
      "kind": "type",
      "definition": "{\n    id: string;\n    chatId: string;\n    updatedAt: number;\n    size?: number;\n}"
    },
    {
      "name": "ChatContext",
      "kind": "type",
      "definition": "ChatContextSummary & {\n    data: any;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface RuntimeChatService {
  createSession(serviceType?: ServiceType, model?: string): Promise<string>;
  sendMessage(sessionId: string, messages: ContentBlock[], options?: ConversationOptions): AsyncIterable<StreamEvent>;
  listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>>;
  deleteChat(chatId: string): Promise<void>;
  getChat(chatId: string): Promise<Chat>;
  saveContext(chatId: string, context: any): Promise<ChatContextSummary>;
  getContext(chatId: string): Promise<ChatContext | any>;
  listContexts(params: PaginationParams): Promise<PaginatedResult<ChatContextSummary>>;
}

// Client interface
export interface RuntimeChatServiceClient {
  createSession(serviceType?: ServiceType, model?: string): Promise<string>;
  sendMessage(sessionId: string, messages: ContentBlock[], options?: ConversationOptions): AsyncIterable<StreamEvent>;
  listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>>;
  deleteChat(chatId: string): Promise<void>;
  getChat(chatId: string): Promise<Chat>;
  saveContext(chatId: string, context: any): Promise<ChatContextSummary>;
  getContext(chatId: string): Promise<ChatContext | any>;
  listContexts(params: PaginationParams): Promise<PaginatedResult<ChatContextSummary>>;
}

// Factory function
export function createRuntimeChatServiceClient(
  config?: { baseUrl?: string },
): RuntimeChatServiceClient {
  return createHttpClient<RuntimeChatServiceClient>(metadata, config);
}

// Ready-to-use client
export const chatClient = createRuntimeChatServiceClient();
