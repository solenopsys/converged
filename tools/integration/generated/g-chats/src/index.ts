// Auto-generated package
import { createHttpClient, type ServiceMetadata } from "nrpc";

export type ChatRoomId = string;

export type ChatUserId = string;

export type ChatThreadId = string;

export type ChatRoomType = "direct" | "group" | "channel";

export type ChatRoomRole = "owner" | "admin" | "member";

export type ChatRoom = {
  id: ChatRoomId;
  title?: string;
  type: ChatRoomType;
  threadId: ChatThreadId;
  createdBy?: ChatUserId;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  membersCount?: number;
};

export type ChatRoomUser = {
  id: string;
  roomId: ChatRoomId;
  userId: ChatUserId;
  role: ChatRoomRole;
  joinedAt: string;
  updatedAt: string;
};

export type CreateChatRoomInput = {
  title?: string;
  type: ChatRoomType;
  threadId: ChatThreadId;
  createdBy?: ChatUserId;
  userIds: ChatUserId[];
};

export type UpdateChatRoomInput = {
  title?: string;
  threadId?: ChatThreadId;
  archived?: boolean;
};

export type ChatRoomsListParams = {
  offset: number;
  limit: number;
  userId?: ChatUserId;
  query?: string;
  type?: ChatRoomType;
  archived?: boolean;
};

export type ChatRoomsListResult = {
  items: ChatRoom[];
  totalCount: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export type ChatContextSummary = {
  id: string;
  chatId: string;
  language?: string;
  updatedAt: number;
  size?: number;
};

export type ChatContext = ChatContextSummary & {
  data: any;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "ChatsService",
  "serviceName": "chats",
  "filePath": "services/communications/chats.ts",
  "methods": [
    {
      "name": "createRoom",
      "parameters": [
        {
          "name": "input",
          "type": "CreateChatRoomInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ChatRoom",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getRoom",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChatRoomId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ChatRoom | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "updateRoom",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChatRoomId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "UpdateChatRoomInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ChatRoom",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteRoom",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChatRoomId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listRooms",
      "parameters": [
        {
          "name": "params",
          "type": "ChatRoomsListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ChatRoomsListResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "addRoomUser",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChatRoomId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "userId",
          "type": "ChatUserId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "role",
          "type": "ChatRoomRole",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "removeRoomUser",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChatRoomId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "userId",
          "type": "ChatUserId",
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
      "name": "listRoomUsers",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChatRoomId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ChatRoomUser",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "listUserRooms",
      "parameters": [
        {
          "name": "userId",
          "type": "ChatUserId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "ChatRoomsListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ChatRoomsListResult",
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
        },
        {
          "name": "language",
          "type": "string",
          "optional": true,
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
        },
        {
          "name": "language",
          "type": "string",
          "optional": true,
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
      "name": "ChatRoomId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ChatUserId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ChatThreadId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ChatRoomType",
      "kind": "type",
      "definition": "\"direct\" | \"group\" | \"channel\""
    },
    {
      "name": "ChatRoomRole",
      "kind": "type",
      "definition": "\"owner\" | \"admin\" | \"member\""
    },
    {
      "name": "ChatRoom",
      "kind": "type",
      "definition": "{\n  id: ChatRoomId;\n  title?: string;\n  type: ChatRoomType;\n  threadId: ChatThreadId;\n  createdBy?: ChatUserId;\n  archived: boolean;\n  createdAt: string;\n  updatedAt: string;\n  membersCount?: number;\n}"
    },
    {
      "name": "ChatRoomUser",
      "kind": "type",
      "definition": "{\n  id: string;\n  roomId: ChatRoomId;\n  userId: ChatUserId;\n  role: ChatRoomRole;\n  joinedAt: string;\n  updatedAt: string;\n}"
    },
    {
      "name": "CreateChatRoomInput",
      "kind": "type",
      "definition": "{\n  title?: string;\n  type: ChatRoomType;\n  threadId: ChatThreadId;\n  createdBy?: ChatUserId;\n  userIds: ChatUserId[];\n}"
    },
    {
      "name": "UpdateChatRoomInput",
      "kind": "type",
      "definition": "{\n  title?: string;\n  threadId?: ChatThreadId;\n  archived?: boolean;\n}"
    },
    {
      "name": "ChatRoomsListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  userId?: ChatUserId;\n  query?: string;\n  type?: ChatRoomType;\n  archived?: boolean;\n}"
    },
    {
      "name": "ChatRoomsListResult",
      "kind": "type",
      "definition": "{\n  items: ChatRoom[];\n  totalCount: number;\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    },
    {
      "name": "ChatContextSummary",
      "kind": "type",
      "definition": "{\n  id: string;\n  chatId: string;\n  language?: string;\n  updatedAt: number;\n  size?: number;\n}"
    },
    {
      "name": "ChatContext",
      "kind": "type",
      "definition": "ChatContextSummary & {\n  data: any;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ChatsService {
  createRoom(input: CreateChatRoomInput): Promise<ChatRoom>;
  getRoom(roomId: ChatRoomId): Promise<ChatRoom | any>;
  updateRoom(roomId: ChatRoomId, patch: UpdateChatRoomInput): Promise<ChatRoom>;
  deleteRoom(roomId: ChatRoomId): Promise<boolean>;
  listRooms(params: ChatRoomsListParams): Promise<ChatRoomsListResult>;
  addRoomUser(roomId: ChatRoomId, userId: ChatUserId, role?: ChatRoomRole): Promise<void>;
  removeRoomUser(roomId: ChatRoomId, userId: ChatUserId): Promise<void>;
  listRoomUsers(roomId: ChatRoomId): Promise<ChatRoomUser[]>;
  listUserRooms(userId: ChatUserId, params: ChatRoomsListParams): Promise<ChatRoomsListResult>;
  saveContext(chatId: string, context: any, language?: string): Promise<ChatContextSummary>;
  getContext(chatId: string, language?: string): Promise<ChatContext | any>;
  listContexts(params: PaginationParams): Promise<PaginatedResult<ChatContextSummary>>;
}

// Client interface
export interface ChatsServiceClient {
  createRoom(input: CreateChatRoomInput): Promise<ChatRoom>;
  getRoom(roomId: ChatRoomId): Promise<ChatRoom | any>;
  updateRoom(roomId: ChatRoomId, patch: UpdateChatRoomInput): Promise<ChatRoom>;
  deleteRoom(roomId: ChatRoomId): Promise<boolean>;
  listRooms(params: ChatRoomsListParams): Promise<ChatRoomsListResult>;
  addRoomUser(roomId: ChatRoomId, userId: ChatUserId, role?: ChatRoomRole): Promise<void>;
  removeRoomUser(roomId: ChatRoomId, userId: ChatUserId): Promise<void>;
  listRoomUsers(roomId: ChatRoomId): Promise<ChatRoomUser[]>;
  listUserRooms(userId: ChatUserId, params: ChatRoomsListParams): Promise<ChatRoomsListResult>;
  saveContext(chatId: string, context: any, language?: string): Promise<ChatContextSummary>;
  getContext(chatId: string, language?: string): Promise<ChatContext | any>;
  listContexts(params: PaginationParams): Promise<PaginatedResult<ChatContextSummary>>;
}

// Factory function
export function createChatsServiceClient(
  config?: { baseUrl?: string },
): ChatsServiceClient {
  return createHttpClient<ChatsServiceClient>(metadata, config);
}

// Ready-to-use client
export const chatsClient = createChatsServiceClient();
