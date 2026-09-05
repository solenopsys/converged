// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type PaginationParams = {
	offset: number;
	limit: number;
	filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type Chat = {
	id: string;
	name: string;
	description: string;
	threadId?: string;
	messagesCount?: number;
	filesCount?: number;
	filesSize?: number;
	createdAt?: number;
	updatedAt?: number;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "AssistantService",
  "serviceName": "assistant",
  "filePath": "ai/assistant.ts",
  "methods": [
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
      "name": "registerChat",
      "parameters": [
        {
          "name": "threadId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "title",
          "type": "string",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "Chat",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "recordChatMessage",
      "parameters": [
        {
          "name": "threadId",
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
      "name": "recordChatFile",
      "parameters": [
        {
          "name": "threadId",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "fileSize",
          "type": "number",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "Chat",
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
    }
  ],
  "types": [
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\tfilter?: FilterObject;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    },
    {
      "name": "Chat",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tname: string;\n\tdescription: string;\n\tthreadId?: string;\n\tmessagesCount?: number;\n\tfilesCount?: number;\n\tfilesSize?: number;\n\tcreatedAt?: number;\n\tupdatedAt?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface AssistantService {
  listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>>;
  registerChat(threadId: string, title?: string): Promise<Chat>;
  recordChatMessage(threadId: string): Promise<Chat>;
  recordChatFile(threadId: string, fileSize?: number): Promise<Chat>;
  deleteChat(chatId: string): Promise<void>;
  getChat(chatId: string): Promise<Chat>;
}

// Client interface
export interface AssistantServiceClient {
  listOfChats(params: PaginationParams): Promise<PaginatedResult<Chat>>;
  registerChat(threadId: string, title?: string): Promise<Chat>;
  recordChatMessage(threadId: string): Promise<Chat>;
  recordChatFile(threadId: string, fileSize?: number): Promise<Chat>;
  deleteChat(chatId: string): Promise<void>;
  getChat(chatId: string): Promise<Chat>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createAssistantServiceClient(
  config: CrullerTransportClientConfig,
): AssistantServiceClient {
  return createCrullerTransportClient<AssistantServiceClient>(metadata, config);
}

export function createAssistantServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): AssistantServiceClient {
  return createAssistantServiceClient(config);
}
