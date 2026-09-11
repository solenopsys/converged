export type ChatRoomId = string;
export type ChatUserId = string;
export type ChatThreadId = string;

export type ChatRoomType = "direct" | "group" | "channel";
export type ChatRoomRole = "owner" | "admin" | "member";

/**
 * Row-level visibility, same vocabulary as the forum. The machinery is the
 * shared `access_tags` table from `access-control.md`; membership shows up
 * there as the tag `u<userId>` on the room. The role below is NOT expressible
 * as a tag, which is why `chat_room_users` survives as its carrier.
 */
export type Visibility = "public" | "authenticated" | "private" | "tagged";

export type ChatRoom = {
  id: ChatRoomId;
  title?: string;

  description?: string;
  type: ChatRoomType;
  threadId: ChatThreadId;
  createdBy?: ChatUserId;
  visibility: Visibility;
  archived: boolean;

  processed?: boolean;

  flud?: boolean;
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

/**
 * No `threadId` and no `createdBy`: the service mints the thread id and reads
 * the author from the verified token. The caller registers the returned
 * `threadId` with `rp-threads` itself — `rp-chats` never calls another service.
 */
export type CreateChatRoomInput = {
  title?: string;
  description?: string;
  type: ChatRoomType;
  visibility?: Visibility;
  userIds: ChatUserId[];
};

export type UpdateChatRoomInput = {
  title?: string;
  description?: string;
  visibility?: Visibility;
  archived?: boolean;
  processed?: boolean;
  flud?: boolean;
};

export type ChatRoomsListParams = {
  offset: number;
  limit: number;
  query?: string;
  type?: ChatRoomType;
  archived?: boolean;

  processed?: boolean;
	filter?: FilterObject;
};

export type FilterObject = Record<string, unknown>;
export type SelectionFieldDescriptor = { id: string; label: string; valueType: "string" | "number" | "boolean" | "date" | "enum"; operators: string[] };
export type SelectionDescriptor = { objectType: string; title: string; fields: SelectionFieldDescriptor[]; filterExample?: FilterObject; revision?: string };
export type SelectionStats = { totalCount: number };

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
  /** Mints id + threadId, stamps the owner from the token, returns the room. */
  createRoom(input: CreateChatRoomInput): Promise<ChatRoom>;
  getRoom(roomId: ChatRoomId): Promise<ChatRoom | null>;
  updateRoom(roomId: ChatRoomId, patch: UpdateChatRoomInput): Promise<ChatRoom>;
  deleteRoom(roomId: ChatRoomId): Promise<boolean>;
  /** Always scoped to the caller from the token, never to `params.userId`. */
  listRooms(params: ChatRoomsListParams): Promise<ChatRoomsListResult>;
	describeSelection(objectType: string): Promise<SelectionDescriptor>;
	inspectChats(filter?: FilterObject): Promise<SelectionStats>;

  addRoomUser(roomId: ChatRoomId, userId: ChatUserId, role?: ChatRoomRole): Promise<void>;
  removeRoomUser(roomId: ChatRoomId, userId: ChatUserId): Promise<void>;
  listRoomUsers(roomId: ChatRoomId): Promise<ChatRoomUser[]>;

  // Multilingual chat contexts, stored as `<lang>/<chatId>.json` (FILES).
  saveContext(chatId: string, context: any, language?: string): Promise<ChatContextSummary>;
  getContext(chatId: string, language?: string): Promise<ChatContext | null>;
  listContexts(params: PaginationParams): Promise<PaginatedResult<ChatContextSummary>>;
}
