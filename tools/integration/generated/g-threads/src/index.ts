// Auto-generated package
import { createHttpClient } from "nrpc";

export type ULID = string;

export type Message = {
  threadId: ULID;
  id?: ULID;
  timestamp?: number;
  beforeId?: ULID;
  user: string;
  type: MessageType;
  data: string;
};

export const metadata = {
  "interfaceName": "ThreadsService",
  "serviceName": "threads",
  "filePath": "../types/threads.ts",
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
      "returnType": "any",
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
      "returnType": "any",
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ULID",
      "definition": "string"
    },
    {
      "name": "Message",
      "definition": "{\n  threadId: ULID;\n  id?: ULID;\n  timestamp?: number;\n  beforeId?: ULID;\n  user: string;\n  type: MessageType;\n  data: string;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ThreadsService {
  saveMessage(message: Message): Promise<any>;
  readMessage(threadId: ULID, messageId: ULID): Promise<any>;
  readMessageVersions(threadId: ULID, messageId: ULID): Promise<any>;
  readThreadAllVersions(threadId: ULID): Promise<any>;
  readThread(threadId: ULID): Promise<any>;
}

// Client interface
export interface ThreadsServiceClient {
  saveMessage(message: Message): Promise<any>;
  readMessage(threadId: ULID, messageId: ULID): Promise<any>;
  readMessageVersions(threadId: ULID, messageId: ULID): Promise<any>;
  readThreadAllVersions(threadId: ULID): Promise<any>;
  readThread(threadId: ULID): Promise<any>;
}

// Factory function
export function createThreadsServiceClient(
  config?: { baseUrl?: string },
): ThreadsServiceClient {
  return createHttpClient<ThreadsServiceClient>(metadata, config);
}

// Ready-to-use client
export const threadsClient = createThreadsServiceClient();
