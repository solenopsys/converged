// Auto-generated package
import { createHttpClient } from "nrpc";

export type ChartRoomId = string;

export type ChartUserId = string;

export type ChartThreadId = string;

export type ChartRoomType = "direct" | "group" | "channel";

export type ChartRoomRole = "owner" | "admin" | "member";

export type ChartRoom = {
  id: ChartRoomId;
  title?: string;
  type: ChartRoomType;
  threadId: ChartThreadId;
  createdBy?: ChartUserId;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  membersCount?: number;
};

export type ChartRoomUser = {
  id: string;
  roomId: ChartRoomId;
  userId: ChartUserId;
  role: ChartRoomRole;
  joinedAt: string;
  updatedAt: string;
};

export type CreateChartRoomInput = {
  title?: string;
  type: ChartRoomType;
  threadId: ChartThreadId;
  createdBy?: ChartUserId;
  userIds: ChartUserId[];
};

export type UpdateChartRoomInput = {
  title?: string;
  threadId?: ChartThreadId;
  archived?: boolean;
};

export type ChartRoomsListParams = {
  offset: number;
  limit: number;
  userId?: ChartUserId;
  query?: string;
  type?: ChartRoomType;
  archived?: boolean;
};

export type ChartRoomsListResult = {
  items: ChartRoom[];
  totalCount: number;
};

export const metadata = {
  "interfaceName": "ChartsService",
  "serviceName": "charts",
  "filePath": "../types/charts.ts",
  "methods": [
    {
      "name": "createRoom",
      "parameters": [
        {
          "name": "input",
          "type": "CreateChartRoomInput",
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
      "name": "getRoom",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChartRoomId",
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
      "name": "updateRoom",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChartRoomId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "UpdateChartRoomInput",
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
      "name": "deleteRoom",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChartRoomId",
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
      "name": "listRooms",
      "parameters": [
        {
          "name": "params",
          "type": "ChartRoomsListParams",
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
      "name": "addRoomUser",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChartRoomId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "userId",
          "type": "ChartUserId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "role",
          "type": "ChartRoomRole",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "removeRoomUser",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChartRoomId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "userId",
          "type": "ChartUserId",
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
      "name": "listRoomUsers",
      "parameters": [
        {
          "name": "roomId",
          "type": "ChartRoomId",
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
      "name": "listUserRooms",
      "parameters": [
        {
          "name": "userId",
          "type": "ChartUserId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "params",
          "type": "ChartRoomsListParams",
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
      "name": "ChartRoomId",
      "definition": "string"
    },
    {
      "name": "ChartUserId",
      "definition": "string"
    },
    {
      "name": "ChartThreadId",
      "definition": "string"
    },
    {
      "name": "ChartRoomType",
      "definition": "\"direct\" | \"group\" | \"channel\""
    },
    {
      "name": "ChartRoomRole",
      "definition": "\"owner\" | \"admin\" | \"member\""
    },
    {
      "name": "ChartRoom",
      "definition": "{\n  id: ChartRoomId;\n  title?: string;\n  type: ChartRoomType;\n  threadId: ChartThreadId;\n  createdBy?: ChartUserId;\n  archived: boolean;\n  createdAt: string;\n  updatedAt: string;\n  membersCount?: number;\n}"
    },
    {
      "name": "ChartRoomUser",
      "definition": "{\n  id: string;\n  roomId: ChartRoomId;\n  userId: ChartUserId;\n  role: ChartRoomRole;\n  joinedAt: string;\n  updatedAt: string;\n}"
    },
    {
      "name": "CreateChartRoomInput",
      "definition": "{\n  title?: string;\n  type: ChartRoomType;\n  threadId: ChartThreadId;\n  createdBy?: ChartUserId;\n  userIds: ChartUserId[];\n}"
    },
    {
      "name": "UpdateChartRoomInput",
      "definition": "{\n  title?: string;\n  threadId?: ChartThreadId;\n  archived?: boolean;\n}"
    },
    {
      "name": "ChartRoomsListParams",
      "definition": "{\n  offset: number;\n  limit: number;\n  userId?: ChartUserId;\n  query?: string;\n  type?: ChartRoomType;\n  archived?: boolean;\n}"
    },
    {
      "name": "ChartRoomsListResult",
      "definition": "{\n  items: ChartRoom[];\n  totalCount: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ChartsService {
  createRoom(input: CreateChartRoomInput): Promise<any>;
  getRoom(roomId: ChartRoomId): Promise<any>;
  updateRoom(roomId: ChartRoomId, patch: UpdateChartRoomInput): Promise<any>;
  deleteRoom(roomId: ChartRoomId): Promise<any>;
  listRooms(params: ChartRoomsListParams): Promise<any>;
  addRoomUser(roomId: ChartRoomId, userId: ChartUserId, role?: ChartRoomRole): Promise<any>;
  removeRoomUser(roomId: ChartRoomId, userId: ChartUserId): Promise<any>;
  listRoomUsers(roomId: ChartRoomId): Promise<any>;
  listUserRooms(userId: ChartUserId, params: ChartRoomsListParams): Promise<any>;
}

// Client interface
export interface ChartsServiceClient {
  createRoom(input: CreateChartRoomInput): Promise<any>;
  getRoom(roomId: ChartRoomId): Promise<any>;
  updateRoom(roomId: ChartRoomId, patch: UpdateChartRoomInput): Promise<any>;
  deleteRoom(roomId: ChartRoomId): Promise<any>;
  listRooms(params: ChartRoomsListParams): Promise<any>;
  addRoomUser(roomId: ChartRoomId, userId: ChartUserId, role?: ChartRoomRole): Promise<any>;
  removeRoomUser(roomId: ChartRoomId, userId: ChartUserId): Promise<any>;
  listRoomUsers(roomId: ChartRoomId): Promise<any>;
  listUserRooms(userId: ChartUserId, params: ChartRoomsListParams): Promise<any>;
}

// Factory function
export function createChartsServiceClient(
  config?: { baseUrl?: string },
): ChartsServiceClient {
  return createHttpClient<ChartsServiceClient>(metadata, config);
}

// Ready-to-use client
export const chartsClient = createChartsServiceClient();
