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

export interface ChatsService {
  createRoom(input: CreateChatRoomInput): Promise<ChatRoom>;
  getRoom(roomId: ChatRoomId): Promise<ChatRoom | null>;
  updateRoom(roomId: ChatRoomId, patch: UpdateChatRoomInput): Promise<ChatRoom>;
  deleteRoom(roomId: ChatRoomId): Promise<boolean>;
  listRooms(params: ChatRoomsListParams): Promise<ChatRoomsListResult>;

  addRoomUser(roomId: ChatRoomId, userId: ChatUserId, role?: ChatRoomRole): Promise<void>;
  removeRoomUser(roomId: ChatRoomId, userId: ChatUserId): Promise<void>;
  listRoomUsers(roomId: ChatRoomId): Promise<ChatRoomUser[]>;
  listUserRooms(userId: ChatUserId, params: ChatRoomsListParams): Promise<ChatRoomsListResult>;

  // Multilingual chat contexts, stored as `<lang>/<chatId>.json` (FILES).
  saveContext(chatId: string, context: any, language?: string): Promise<ChatContextSummary>;
  getContext(chatId: string, language?: string): Promise<ChatContext | null>;
  listContexts(params: PaginationParams): Promise<PaginatedResult<ChatContextSummary>>;
}
