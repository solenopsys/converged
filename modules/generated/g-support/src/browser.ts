// Auto-generated browser NRPC package
import {
  createWebSocketClient,
  type ServiceMetadata,
  type WebSocketClientConfig,
} from "nrpc";

export type TicketId = string;

export type ThreadId = string;

export type UserId = string;

export type ISODateString = string;

export type TicketType = "bug" | "feature";

export type TicketStatus = "open" | "planned" | "in_progress" | "done" | "rejected";

export type Ticket = {
	id: TicketId;
	/** Human-readable: #142. Server-assigned, never reused. */
	number: number;
	type: TicketType;
	title: string;
	status: TicketStatus;
	authorId: UserId;
	/** Description, replies and files all live in `rp-threads`. */
	threadId: ThreadId;
	/** Denormalised so the rating can be ordered by it. */
	votes: number;
	createdAt: ISODateString;
	updatedAt: ISODateString;
};

export type CreateTicketInput = {
	type: TicketType;
	title: string;
	threadId: ThreadId;
};

export type TicketSort = "newest" | "votes";

export type TicketListParams = {
	offset: number;
	limit: number;
	type?: TicketType;
	status?: TicketStatus;
	/** Only the caller's own. */
	mine?: boolean;
	/** Case-insensitive match on the title — what deduplication searches with. */
	query?: string;
	sort?: TicketSort;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "SupportService",
  "serviceName": "support",
  "filePath": "communications/support.ts",
  "methods": [
    {
      "name": "createTicket",
      "parameters": [
        {
          "name": "input",
          "type": "CreateTicketInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Ticket",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getTicket",
      "parameters": [
        {
          "name": "id",
          "type": "TicketId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Ticket | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listTickets",
      "parameters": [
        {
          "name": "params",
          "type": "TicketListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Ticket>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "vote",
      "parameters": [
        {
          "name": "id",
          "type": "TicketId",
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
      "name": "unvote",
      "parameters": [
        {
          "name": "id",
          "type": "TicketId",
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
      "name": "setStatus",
      "parameters": [
        {
          "name": "id",
          "type": "TicketId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "status",
          "type": "TicketStatus",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Ticket",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "TicketId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ThreadId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "UserId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "TicketType",
      "kind": "type",
      "definition": "\"bug\" | \"feature\""
    },
    {
      "name": "TicketStatus",
      "kind": "type",
      "definition": "\"open\" | \"planned\" | \"in_progress\" | \"done\" | \"rejected\""
    },
    {
      "name": "Ticket",
      "kind": "type",
      "definition": "{\n\tid: TicketId;\n\t/** Human-readable: #142. Server-assigned, never reused. */\n\tnumber: number;\n\ttype: TicketType;\n\ttitle: string;\n\tstatus: TicketStatus;\n\tauthorId: UserId;\n\t/** Description, replies and files all live in `rp-threads`. */\n\tthreadId: ThreadId;\n\t/** Denormalised so the rating can be ordered by it. */\n\tvotes: number;\n\tcreatedAt: ISODateString;\n\tupdatedAt: ISODateString;\n}"
    },
    {
      "name": "CreateTicketInput",
      "kind": "type",
      "definition": "{\n\ttype: TicketType;\n\ttitle: string;\n\tthreadId: ThreadId;\n}"
    },
    {
      "name": "TicketSort",
      "kind": "type",
      "definition": "\"newest\" | \"votes\""
    },
    {
      "name": "TicketListParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\ttype?: TicketType;\n\tstatus?: TicketStatus;\n\t/** Only the caller's own. */\n\tmine?: boolean;\n\t/** Case-insensitive match on the title — what deduplication searches with. */\n\tquery?: string;\n\tsort?: TicketSort;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    }
  ]
};

// Client interface
export interface SupportServiceClient {
  createTicket(input: CreateTicketInput): Promise<Ticket>;
  getTicket(id: TicketId): Promise<Ticket | any>;
  listTickets(params: TicketListParams): Promise<PaginatedResult<Ticket>>;
  vote(id: TicketId): Promise<number>;
  unvote(id: TicketId): Promise<number>;
  setStatus(id: TicketId, status: TicketStatus): Promise<Ticket>;
}

// Browser factory: frontend builds select this entrypoint automatically.
// The channel controller owns the shared WebSocket connection to Fujin.
export function createSupportServiceClient(
  config: WebSocketClientConfig,
): SupportServiceClient {
  return createWebSocketClient<SupportServiceClient>(metadata, config);
}

export function createSupportServiceWebSocketClient(
  config: WebSocketClientConfig,
): SupportServiceClient {
  return createSupportServiceClient(config);
}
