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
}

// Client interface
export interface ThreadsServiceClient {
  saveMessage(message: Message): Promise<string>;
  readMessage(threadId: ULID, messageId: ULID): Promise<Message>;
  readMessageVersions(threadId: ULID, messageId: ULID): Promise<Message[]>;
  readThreadAllVersions(threadId: ULID): Promise<Message[]>;
  readThread(threadId: ULID): Promise<Message[]>;
}

// Factory function
export function createThreadsServiceClient(
  config?: { baseUrl?: string },
): ThreadsServiceClient {
  return createHttpClient<ThreadsServiceClient>(metadata, config);
}

// Ready-to-use client
export const threadsClient = createThreadsServiceClient();
