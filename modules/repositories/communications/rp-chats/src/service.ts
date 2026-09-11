import { Access, getCurrentWorkspaceContext } from "nrpc";
import type {
  ChatsService,
  ChatContext,
  ChatContextSummary,
  ChatRoom,
  ChatRoomId,
  ChatRoomRole,
  ChatRoomsListParams,
  ChatRoomsListResult,
	FilterObject,
  ChatRoomUser,
  ChatUserId,
  CreateChatRoomInput,
  PaginatedResult,
  PaginationParams,
  UpdateChatRoomInput,
	SelectionDescriptor,
	SelectionStats,
} from "./types";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-chats";

/**
 * Who is calling, from the verified token and from nothing else. The envelope's
 * own claim is ignored by `messaging-backend` in favour of this, which is what
 * makes it the one identifier a caller cannot pick for itself.
 */
function requireActor(): string {
  const actor = getCurrentWorkspaceContext()?.user?.trim();
  if (!actor) throw new Error("Authenticated caller is required");
  return actor;
}

export class ChatsServiceImpl implements ChatsService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(REPOSITORY_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  /**
   * Every method here carries a deliberate level. An undecorated method also
   * resolves to `"user"`, so without the decorator nobody can tell a decision
   * from an oversight — and `deleteRoom` takes the whole room with it.
   */
  @Access("user")
  async createRoom(input: CreateChatRoomInput): Promise<ChatRoom> {
    await this.ready();
    return this.stores.chats.createRoom(input, requireActor());
  }

  @Access("user")
  async getRoom(roomId: ChatRoomId): Promise<ChatRoom | null> {
    await this.ready();
    return this.stores.chats.getRoom(roomId);
  }

  @Access("user")
  async updateRoom(roomId: ChatRoomId, patch: UpdateChatRoomInput): Promise<ChatRoom> {
    await this.ready();
    await this.requireMembership(roomId);
    return this.stores.chats.updateRoom(roomId, patch);
  }

  @Access("user")
  async deleteRoom(roomId: ChatRoomId): Promise<boolean> {
    await this.ready();
    await this.requireMembership(roomId);
    return this.stores.chats.deleteRoom(roomId);
  }

  @Access("user")
  async listRooms(params: ChatRoomsListParams): Promise<ChatRoomsListResult> {
    await this.ready();
    return this.stores.chats.listRooms(params, requireActor());
  }

  @Access("user")
	async describeSelection(objectType: string): Promise<SelectionDescriptor> {
		if (objectType !== "chats.chat") throw new Error(`Unsupported chat selection object: ${objectType}`);
		return { objectType, title: "Chats", fields: [{ id: "title", label: "Room", valueType: "string", operators: ["eq", "in", "contains", "startsWith", "isNull"] }, { id: "type", label: "Type", valueType: "enum", operators: ["eq", "in", "notEq", "notIn"] }, { id: "archived", label: "Archived", valueType: "boolean", operators: ["eq", "notEq"] }], revision: "chats-v1" };
	}

  @Access("user")
	async inspectChats(filter?: FilterObject): Promise<SelectionStats> {
		await this.ready(); return { totalCount: await this.stores.chats.countRooms(filter) };
	}

  @Access("user")
  async addRoomUser(roomId: ChatRoomId, userId: ChatUserId, role?: ChatRoomRole): Promise<void> {
    await this.ready();
    await this.requireMembership(roomId);
    return this.stores.chats.addRoomUser(roomId, userId, role);
  }

  @Access("user")
  async removeRoomUser(roomId: ChatRoomId, userId: ChatUserId): Promise<void> {
    await this.ready();
    await this.requireMembership(roomId);
    return this.stores.chats.removeRoomUser(roomId, userId);
  }

  @Access("user")
  async listRoomUsers(roomId: ChatRoomId): Promise<ChatRoomUser[]> {
    await this.ready();
    await this.requireMembership(roomId);
    return this.stores.chats.listRoomUsers(roomId);
  }

  /**
   * Membership is the room's read permission, so anything addressing one room
   * by id checks it. `listRooms` does not: there the same rule is already part
   * of the query, which is what keeps `totalCount` honest.
   */
  private async requireMembership(roomId: ChatRoomId): Promise<string> {
    const actor = requireActor();
    if (!(await this.stores.chats.isRoomMember(roomId, actor))) {
      throw new Error("Not a member of this room");
    }
    return actor;
  }

  // A context belongs to a room, so reading or writing one is a room
  // operation and answers to the room's membership. Without this the file
  // store is addressable by anyone who can guess a room id.
  @Access("user")
  async saveContext(
    chatId: string,
    context: any,
    language?: string,
  ): Promise<ChatContextSummary> {
    await this.ready();
    await this.requireMembership(chatId);
    return this.stores.contexts.saveContext(chatId, context, language);
  }

  @Access("user")
  async getContext(chatId: string, language?: string): Promise<ChatContext | null> {
    await this.ready();
    await this.requireMembership(chatId);
    return this.stores.contexts.getContext(chatId, language);
  }

  // Lists every room's context, so it is an administrative read rather than a
  // participant one. `sf-contexts` reads `rp-contexts`, not this, so raising
  // the level here costs no caller. Downgrade it only together with a
  // per-room predicate.
  @Access("internal")
  async listContexts(
    params: PaginationParams,
  ): Promise<PaginatedResult<ChatContextSummary>> {
    await this.ready();
    return this.stores.contexts.listContexts(params);
  }
}

export default ChatsServiceImpl;
