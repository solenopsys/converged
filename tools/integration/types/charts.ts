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

export interface ChartsService {
  createRoom(input: CreateChartRoomInput): Promise<ChartRoom>;
  getRoom(roomId: ChartRoomId): Promise<ChartRoom | null>;
  updateRoom(roomId: ChartRoomId, patch: UpdateChartRoomInput): Promise<ChartRoom>;
  deleteRoom(roomId: ChartRoomId): Promise<boolean>;
  listRooms(params: ChartRoomsListParams): Promise<ChartRoomsListResult>;

  addRoomUser(roomId: ChartRoomId, userId: ChartUserId, role?: ChartRoomRole): Promise<void>;
  removeRoomUser(roomId: ChartRoomId, userId: ChartUserId): Promise<void>;
  listRoomUsers(roomId: ChartRoomId): Promise<ChartRoomUser[]>;
  listUserRooms(userId: ChartUserId, params: ChartRoomsListParams): Promise<ChartRoomsListResult>;
}
