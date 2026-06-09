// Auto-generated package
import { createHttpClient } from "nrpc";

export type ULID = string;

export enum MessageType {
  message = "message",
  link = "link",
  partition = "partition",
}

export type Message = {
  threadId: ULID;
  id?: ULID;
  timestamp?: number;
  beforeId?: ULID;
  user: string;
  type: MessageType;
  data: string;
};

export type ThreadKind = "chat" | "audio" | "forum" | "comment";

export type ThreadInfo = {
  threadId: ULID;
  kind: ThreadKind;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
};

export type ThreadListParams = {
  offset?: number;
  limit?: number;
  kind?: ThreadKind;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export type ThreadStats = {
  total: number;
  totalMessages: number;
  byKind: Record<ThreadKind, number>;
};

export const metadata = {
  "interfaceName": "ThreadsService",
  "serviceName": "threads",
  "filePath": "services/communications/threads.ts",
  "methods": [
    {
      "name": "saveMessage",
      "parameters": [
        {
          "name": "message",
          "type": "Message",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "string",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "readMessage",
      "parameters": [
        {
          "name": "threadId",
          "type": "ULID",
          "optional": false,
          "isArray": false
        },
        {
          "name": "messageId",
          "type": "ULID",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Message",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "readMessageVersions",
      "parameters": [
        {
          "name": "threadId",
          "type": "ULID",
          "optional": false,
          "isArray": false
        },
        {
          "name": "messageId",
          "type": "ULID",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Message",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "readThreadAllVersions",
      "parameters": [
        {
          "name": "threadId",
          "type": "ULID",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Message",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "readThread",
      "parameters": [
        {
          "name": "threadId",
          "type": "ULID",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Message",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "registerThread",
      "parameters": [
        {
          "name": "threadId",
          "type": "ULID",
          "optional": false,
          "isArray": false
        },
        {
          "name": "kind",
          "type": "ThreadKind",
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
      "name": "listThreads",
      "parameters": [
        {
          "name": "params",
          "type": "ThreadListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<ThreadInfo>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getThreadStats",
      "parameters": [],
      "returnType": "ThreadStats",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ULID",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "MessageType",
      "kind": "raw",
      "definition": "export enum MessageType {\n  message = \"message\",\n  link = \"link\",\n  partition = \"partition\",\n}"
    },
    {
      "name": "Message",
      "kind": "type",
      "definition": "{\n  threadId: ULID;\n  id?: ULID;\n  timestamp?: number;\n  beforeId?: ULID;\n  user: string;\n  type: MessageType;\n  data: string;\n}"
    },
    {
      "name": "ThreadKind",
      "kind": "type",
      "definition": "\"chat\" | \"audio\" | \"forum\" | \"comment\""
    },
    {
      "name": "ThreadInfo",
      "kind": "type",
      "definition": "{\n  threadId: ULID;\n  kind: ThreadKind;\n  messageCount: number;\n  createdAt: number;\n  updatedAt: number;\n}"
    },
    {
      "name": "ThreadListParams",
      "kind": "type",
      "definition": "{\n  offset?: number;\n  limit?: number;\n  kind?: ThreadKind;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "ThreadStats",
      "kind": "type",
      "definition": "{\n  total: number;\n  totalMessages: number;\n  byKind: Record<ThreadKind, number>;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ThreadsService {
  saveMessage(message: Message): Promise<string>;
  readMessage(threadId: ULID, messageId: ULID): Promise<Message>;
  readMessageVersions(threadId: ULID, messageId: ULID): Promise<Message[]>;
  readThreadAllVersions(threadId: ULID): Promise<Message[]>;
  readThread(threadId: ULID): Promise<Message[]>;
  registerThread(threadId: ULID, kind: ThreadKind): Promise<void>;
  listThreads(params: ThreadListParams): Promise<PaginatedResult<ThreadInfo>>;
  getThreadStats(): Promise<ThreadStats>;
}

// Client interface
export interface ThreadsServiceClient {
  saveMessage(message: Message): Promise<string>;
  readMessage(threadId: ULID, messageId: ULID): Promise<Message>;
  readMessageVersions(threadId: ULID, messageId: ULID): Promise<Message[]>;
  readThreadAllVersions(threadId: ULID): Promise<Message[]>;
  readThread(threadId: ULID): Promise<Message[]>;
  registerThread(threadId: ULID, kind: ThreadKind): Promise<void>;
  listThreads(params: ThreadListParams): Promise<PaginatedResult<ThreadInfo>>;
  getThreadStats(): Promise<ThreadStats>;
}

// Factory function
export function createThreadsServiceClient(
  config?: { baseUrl?: string },
): ThreadsServiceClient {
  return createHttpClient<ThreadsServiceClient>(metadata, config);
}

// Ready-to-use client
export const threadsClient = createThreadsServiceClient();
