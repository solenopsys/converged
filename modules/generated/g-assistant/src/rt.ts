// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

export type PaginationParams = {
	offset: number;
	limit: number;
};

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

const metadata: ServiceMetadata = {
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
      "definition": "{\n\toffset: number;\n\tlimit: number;\n}"
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

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface AssistantServiceRtClient {
  listOfChats(params: PaginationParams): PaginatedResult<Chat>;
  registerChat(threadId: string, title?: string): Chat;
  recordChatMessage(threadId: string): Chat;
  recordChatFile(threadId: string, fileSize?: number): Chat;
  deleteChat(chatId: string): void;
  getChat(chatId: string): Chat;
}

export function createAssistantServiceRtClient(): AssistantServiceRtClient {
  return createRtClient<AssistantServiceRtClient>(metadata);
}
