// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

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
	filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;

export type SelectionFieldDescriptor = {
	id: string;
	label: string;
	valueType: "string" | "number" | "boolean" | "date" | "enum";
	operators: string[];
};

export type SelectionDescriptor = {
	objectType: string;
	title: string;
	fields: SelectionFieldDescriptor[];
	filterExample?: FilterObject;
	revision?: string;
};

export type SelectionStats = { totalCount: number };

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export type ThreadStats = {
	total: number;
	totalMessages: number;
	byKind: Record<ThreadKind, number>;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "ThreadsService",
  "serviceName": "threads",
  "filePath": "communications/threads.ts",
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
    },
    {
      "name": "describeSelection",
      "parameters": [
        {
          "name": "objectType",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "SelectionDescriptor",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "inspectThreads",
      "parameters": [
        {
          "name": "filter",
          "type": "FilterObject",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "SelectionStats",
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
      "definition": "{\n\toffset?: number;\n\tlimit?: number;\n\tkind?: ThreadKind;\n\tfilter?: FilterObject;\n}"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "SelectionFieldDescriptor",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tlabel: string;\n\tvalueType: \"string\" | \"number\" | \"boolean\" | \"date\" | \"enum\";\n\toperators: string[];\n}"
    },
    {
      "name": "SelectionDescriptor",
      "kind": "type",
      "definition": "{\n\tobjectType: string;\n\ttitle: string;\n\tfields: SelectionFieldDescriptor[];\n\tfilterExample?: FilterObject;\n\trevision?: string;\n}"
    },
    {
      "name": "SelectionStats",
      "kind": "type",
      "definition": "{ totalCount: number }"
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

// Server interface (to be implemented in microservice)
export interface ThreadsService {
  saveMessage(message: Message): Promise<string>;
  readMessage(threadId: ULID, messageId: ULID): Promise<Message>;
  readMessageVersions(threadId: ULID, messageId: ULID): Promise<Message[]>;
  readThreadAllVersions(threadId: ULID): Promise<Message[]>;
  readThread(threadId: ULID): Promise<Message[]>;
  deleteThread(threadId: ULID): Promise<number>;
  registerThread(threadId: ULID, kind: ThreadKind): Promise<void>;
  listThreads(params: ThreadListParams): Promise<PaginatedResult<ThreadInfo>>;
  getThreadStats(): Promise<ThreadStats>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectThreads(filter?: FilterObject): Promise<SelectionStats>;
}

// Client interface
export interface ThreadsServiceClient {
  saveMessage(message: Message): Promise<string>;
  readMessage(threadId: ULID, messageId: ULID): Promise<Message>;
  readMessageVersions(threadId: ULID, messageId: ULID): Promise<Message[]>;
  readThreadAllVersions(threadId: ULID): Promise<Message[]>;
  readThread(threadId: ULID): Promise<Message[]>;
  deleteThread(threadId: ULID): Promise<number>;
  registerThread(threadId: ULID, kind: ThreadKind): Promise<void>;
  listThreads(params: ThreadListParams): Promise<PaginatedResult<ThreadInfo>>;
  getThreadStats(): Promise<ThreadStats>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectThreads(filter?: FilterObject): Promise<SelectionStats>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createThreadsServiceClient(
  config: CrullerTransportClientConfig,
): ThreadsServiceClient {
  return createCrullerTransportClient<ThreadsServiceClient>(metadata, config);
}

export function createThreadsServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): ThreadsServiceClient {
  return createThreadsServiceClient(config);
}
