import type {
  ChatsService,
  ChatContext,
  ChatContextSummary,
  ChatRoom,
  ChatRoomId,
  ChatRoomRole,
  ChatRoomsListParams,
  ChatRoomsListResult,
  ChatRoomUser,
  ChatUserId,
  CreateChatRoomInput,
  PaginatedResult,
  PaginationParams,
  UpdateChatRoomInput,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "chats-ms";

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
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  async createRoom(input: CreateChatRoomInput): Promise<ChatRoom> {
    await this.ready();
    return this.stores.chats.createRoom(input);
  }

  async getRoom(roomId: ChatRoomId): Promise<ChatRoom | null> {
    await this.ready();
    return this.stores.chats.getRoom(roomId);
  }

  async updateRoom(roomId: ChatRoomId, patch: UpdateChatRoomInput): Promise<ChatRoom> {
    await this.ready();
    return this.stores.chats.updateRoom(roomId, patch);
  }

  async deleteRoom(roomId: ChatRoomId): Promise<boolean> {
    await this.ready();
    return this.stores.chats.deleteRoom(roomId);
  }

  async listRooms(params: ChatRoomsListParams): Promise<ChatRoomsListResult> {
    await this.ready();
    return this.stores.chats.listRooms(params);
  }

  async addRoomUser(roomId: ChatRoomId, userId: ChatUserId, role?: ChatRoomRole): Promise<void> {
    await this.ready();
    return this.stores.chats.addRoomUser(roomId, userId, role);
  }

  async removeRoomUser(roomId: ChatRoomId, userId: ChatUserId): Promise<void> {
    await this.ready();
    return this.stores.chats.removeRoomUser(roomId, userId);
  }

  async listRoomUsers(roomId: ChatRoomId): Promise<ChatRoomUser[]> {
    await this.ready();
    return this.stores.chats.listRoomUsers(roomId);
  }

  async listUserRooms(userId: ChatUserId, params: ChatRoomsListParams): Promise<ChatRoomsListResult> {
    await this.ready();
    return this.stores.chats.listUserRooms(userId, params);
  }

  async saveContext(
    chatId: string,
    context: any,
    language?: string,
  ): Promise<ChatContextSummary> {
    await this.ready();
    return this.stores.contexts.saveContext(chatId, context, language);
  }

  async getContext(chatId: string, language?: string): Promise<ChatContext | null> {
    await this.ready();
    return this.stores.contexts.getContext(chatId, language);
  }

  async listContexts(
    params: PaginationParams,
  ): Promise<PaginatedResult<ChatContextSummary>> {
    await this.ready();
    return this.stores.contexts.listContexts(params);
  }
}

export default ChatsServiceImpl;
