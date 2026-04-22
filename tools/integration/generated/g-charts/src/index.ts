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
  "filePath": "services/communications/charts.ts",
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
      "returnType": "ChartRoom",
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
      "returnType": "ChartRoom | any",
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
      "returnType": "ChartRoom",
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
          "type": "ChartRoomsListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ChartRoomsListResult",
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
          "type": "ChartRoomId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ChartRoomUser",
      "isAsync": true,
      "returnTypeIsArray": true,
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
      "returnType": "ChartRoomsListResult",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ChartRoomId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ChartUserId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ChartThreadId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ChartRoomType",
      "kind": "type",
      "definition": "\"direct\" | \"group\" | \"channel\""
    },
    {
      "name": "ChartRoomRole",
      "kind": "type",
      "definition": "\"owner\" | \"admin\" | \"member\""
    },
    {
      "name": "ChartRoom",
      "kind": "type",
      "definition": "{\n  id: ChartRoomId;\n  title?: string;\n  type: ChartRoomType;\n  threadId: ChartThreadId;\n  createdBy?: ChartUserId;\n  archived: boolean;\n  createdAt: string;\n  updatedAt: string;\n  membersCount?: number;\n}"
    },
    {
      "name": "ChartRoomUser",
      "kind": "type",
      "definition": "{\n  id: string;\n  roomId: ChartRoomId;\n  userId: ChartUserId;\n  role: ChartRoomRole;\n  joinedAt: string;\n  updatedAt: string;\n}"
    },
    {
      "name": "CreateChartRoomInput",
      "kind": "type",
      "definition": "{\n  title?: string;\n  type: ChartRoomType;\n  threadId: ChartThreadId;\n  createdBy?: ChartUserId;\n  userIds: ChartUserId[];\n}"
    },
    {
      "name": "UpdateChartRoomInput",
      "kind": "type",
      "definition": "{\n  title?: string;\n  threadId?: ChartThreadId;\n  archived?: boolean;\n}"
    },
    {
      "name": "ChartRoomsListParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n  userId?: ChartUserId;\n  query?: string;\n  type?: ChartRoomType;\n  archived?: boolean;\n}"
    },
    {
      "name": "ChartRoomsListResult",
      "kind": "type",
      "definition": "{\n  items: ChartRoom[];\n  totalCount: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ChartsService {
  createRoom(input: CreateChartRoomInput): Promise<ChartRoom>;
  getRoom(roomId: ChartRoomId): Promise<ChartRoom | any>;
  updateRoom(roomId: ChartRoomId, patch: UpdateChartRoomInput): Promise<ChartRoom>;
  deleteRoom(roomId: ChartRoomId): Promise<boolean>;
  listRooms(params: ChartRoomsListParams): Promise<ChartRoomsListResult>;
  addRoomUser(roomId: ChartRoomId, userId: ChartUserId, role?: ChartRoomRole): Promise<void>;
  removeRoomUser(roomId: ChartRoomId, userId: ChartUserId): Promise<void>;
  listRoomUsers(roomId: ChartRoomId): Promise<ChartRoomUser[]>;
  listUserRooms(userId: ChartUserId, params: ChartRoomsListParams): Promise<ChartRoomsListResult>;
}

// Client interface
export interface ChartsServiceClient {
  createRoom(input: CreateChartRoomInput): Promise<ChartRoom>;
  getRoom(roomId: ChartRoomId): Promise<ChartRoom | any>;
  updateRoom(roomId: ChartRoomId, patch: UpdateChartRoomInput): Promise<ChartRoom>;
  deleteRoom(roomId: ChartRoomId): Promise<boolean>;
  listRooms(params: ChartRoomsListParams): Promise<ChartRoomsListResult>;
  addRoomUser(roomId: ChartRoomId, userId: ChartUserId, role?: ChartRoomRole): Promise<void>;
  removeRoomUser(roomId: ChartRoomId, userId: ChartUserId): Promise<void>;
  listRoomUsers(roomId: ChartRoomId): Promise<ChartRoomUser[]>;
  listUserRooms(userId: ChartUserId, params: ChartRoomsListParams): Promise<ChartRoomsListResult>;
}

// Factory function
export function createChartsServiceClient(
  config?: { baseUrl?: string },
): ChartsServiceClient {
  return createHttpClient<ChartsServiceClient>(metadata, config);
}

// Ready-to-use client
export const chartsClient = createChartsServiceClient();
