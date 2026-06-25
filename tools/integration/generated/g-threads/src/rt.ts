// Auto-generated RT entrypoint (QuickJS / Zig host transport)
import { createRtClient, type ServiceMetadata } from "nrpc";

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

const metadata: ServiceMetadata = {
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
      "name": "deleteThread",
      "parameters": [
        {
          "name": "threadId",
          "type": "ULID",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "number",
      "isAsync": true,
      "returnTypeIsArray": false,
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
      "definition": "export enum MessageType {\n\tmessage = \"message\",\n\tlink = \"link\",\n\tpartition = \"partition\",\n}"
    },
    {
      "name": "Message",
      "kind": "type",
      "definition": "{\n\tthreadId: ULID;\n\tid?: ULID;\n\ttimestamp?: number;\n\tbeforeId?: ULID;\n\tuser: string;\n\ttype: MessageType;\n\tdata: string;\n}"
    },
    {
      "name": "ThreadKind",
      "kind": "type",
      "definition": "\"chat\" | \"audio\" | \"forum\" | \"comment\""
    },
    {
      "name": "ThreadInfo",
      "kind": "type",
      "definition": "{\n\tthreadId: ULID;\n\tkind: ThreadKind;\n\tmessageCount: number;\n\tcreatedAt: number;\n\tupdatedAt: number;\n}"
    },
    {
      "name": "ThreadListParams",
      "kind": "type",
      "definition": "{\n\toffset?: number;\n\tlimit?: number;\n\tkind?: ThreadKind;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    },
    {
      "name": "ThreadStats",
      "kind": "type",
      "definition": "{\n\ttotal: number;\n\ttotalMessages: number;\n\tbyKind: Record<ThreadKind, number>;\n}"
    }
  ]
};

// RT client interface — synchronous (one QuickJS evaluation per workflow run).
export interface ThreadsServiceRtClient {
  saveMessage(message: Message): string;
  readMessage(threadId: ULID, messageId: ULID): Message;
  readMessageVersions(threadId: ULID, messageId: ULID): Message[];
  readThreadAllVersions(threadId: ULID): Message[];
  readThread(threadId: ULID): Message[];
  deleteThread(threadId: ULID): number;
  registerThread(threadId: ULID, kind: ThreadKind): void;
  listThreads(params: ThreadListParams): PaginatedResult<ThreadInfo>;
  getThreadStats(): ThreadStats;
}

export function createThreadsServiceRtClient(): ThreadsServiceRtClient {
  return createRtClient<ThreadsServiceRtClient>(metadata);
}
