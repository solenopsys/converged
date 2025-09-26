// Auto-generated frontend client
import { createHttpClient } from 'nrpc';

export type Message = {
    threadId: ULID,
    id?: ULID,
    timestamp?: number,
    beforeId?: ULID,
    user: string,
    type: MessageType,
    data: string
};

const metadata = {
  "interfaceName": "ThreadsService",
  "serviceName": "threads",
  "filePath": "/home/alexstorm/distrib/4ir/CONVERGED/public/types/threads.ts",
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
      "name": "Message",
      "definition": "{\n    threadId: ULID,\n    id?: ULID,\n    timestamp?: number,\n    beforeId?: ULID,\n    user: string,\n    type: MessageType,\n    data: string\n}"
    }
  ]
};

// Service client interface
export interface ThreadsServiceClient {
  saveMessage(message: Message): Promise<any>;
  readMessage(threadId: ULID, messageId: ULID): Promise<any>;
  readMessageVersions(threadId: ULID, messageId: ULID): Promise<any>;
  readThreadAllVersions(threadId: ULID): Promise<any>;
  readThread(threadId: ULID): Promise<any>;
}

// Factory function
export function createThreadsServiceClient(config?: { baseUrl?: string }): ThreadsServiceClient {
  return createHttpClient<ThreadsServiceClient>(metadata, config);
}

// Export ready-to-use client
export const threadsClient = createThreadsServiceClient();
