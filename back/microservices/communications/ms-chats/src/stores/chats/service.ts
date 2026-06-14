import { SqlStore, generateULID } from "back-core";
import type {
  ChatRoom,
  ChatRoomId,
  ChatRoomRole,
  ChatRoomsListParams,
  ChatRoomsListResult,
  ChatRoomUser,
  ChatUserId,
  CreateChatRoomInput,
  UpdateChatRoomInput,
} from "../../types";
import {
  ChatRoomRepository,
  ChatRoomUserRepository,
  type ChatRoomEntity,
  type ChatRoomUserEntity,
} from "./entities";

export class ChatsStoreService {
  private readonly roomRepo: ChatRoomRepository;
  private readonly roomUserRepo: ChatRoomUserRepository;

  constructor(private store: SqlStore) {
    this.roomRepo = new ChatRoomRepository(store, "chart_rooms", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });

    this.roomUserRepo = new ChatRoomUserRepository(store, "chart_room_users", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async createRoom(input: CreateChatRoomInput): Promise<ChatRoom> {
    const roomId = generateULID();
    const now = new Date().toISOString();

    const roomEntity: ChatRoomEntity = {
      id: roomId,
      title: input.title ?? null,
      description: null,
      type: input.type,
      threadId: input.threadId,
      createdBy: input.createdBy ?? null,
      archived: 0,
      processed: 0,
      flud: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.roomRepo.create(roomEntity as any);

    const userSet = new Set<string>(input.userIds ?? []);
    if (input.createdBy) {
      userSet.add(input.createdBy);
    }

    for (const userId of userSet) {
      const role: ChatRoomRole = input.createdBy && userId === input.createdBy ? "owner" : "member";
      await this.createOrUpdateRoomUser(roomId, userId, role, now);
    }

    const created = await this.getRoom(roomId);
    if (!created) {
      throw new Error(`Failed to create room: ${roomId}`);
    }

    return created;
  }

  async getRoom(roomId: ChatRoomId): Promise<ChatRoom | null> {
    const room = await this.roomRepo.findById({ id: roomId });
    if (!room) return null;

    const counts = await this.getMembersCountMap([room.id]);
    return this.toRoom(room, counts[room.id] ?? 0);
  }

  async updateRoom(roomId: ChatRoomId, patch: UpdateChatRoomInput): Promise<ChatRoom> {
    const existing = await this.roomRepo.findById({ id: roomId });
    if (!existing) {
      throw new Error(`Room not found: ${roomId}`);
    }

    const update: Partial<ChatRoomEntity> = {
      updatedAt: new Date().toISOString(),
    };

    if (patch.title !== undefined) {
      update.title = patch.title ?? null;
    }
    if (patch.description !== undefined) {
      update.description = patch.description ?? null;
    }
    if (patch.threadId !== undefined) {
      update.threadId = patch.threadId;
    }
    if (patch.archived !== undefined) {
      update.archived = patch.archived ? 1 : 0;
    }
    if (patch.processed !== undefined) {
      update.processed = patch.processed ? 1 : 0;
    }
    if (patch.flud !== undefined) {
      update.flud = patch.flud ? 1 : 0;
    }

    await this.roomRepo.update({ id: roomId }, update);

    const updated = await this.getRoom(roomId);
    if (!updated) {
      throw new Error(`Failed to update room: ${roomId}`);
    }

    return updated;
  }

  async deleteRoom(roomId: ChatRoomId): Promise<boolean> {
    await this.store.db.deleteFrom("chart_room_users").where("roomId", "=", roomId).execute();
    return this.roomRepo.delete({ id: roomId });
  }

  async listRooms(params: ChatRoomsListParams): Promise<ChatRoomsListResult> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("chart_rooms").selectAll();

    if (params.type) {
      query = query.where("type", "=", params.type);
    }
    if (params.archived !== undefined) {
      query = query.where("archived", "=", params.archived ? 1 : 0);
    }
    if (params.processed !== undefined) {
      query = query.where("processed", "=", params.processed ? 1 : 0);
    }

    const textQuery = params.query?.trim();
    if (textQuery) {
      query = query.where("title", "like", `%${textQuery}%`);
    }

    if (params.userId) {
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom("chart_room_users")
            .select("id")
            .whereRef("chart_room_users.roomId", "=", "chart_rooms.id")
            .where("chart_room_users.userId", "=", params.userId as string),
        ),
      );
    }

    const rows = await query
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("chart_rooms")
      .select(({ fn }) => fn.countAll().as("count"));

    if (params.type) {
      countQuery = countQuery.where("type", "=", params.type);
    }
    if (params.archived !== undefined) {
      countQuery = countQuery.where("archived", "=", params.archived ? 1 : 0);
    }
    if (params.processed !== undefined) {
      countQuery = countQuery.where("processed", "=", params.processed ? 1 : 0);
    }
    if (textQuery) {
      countQuery = countQuery.where("title", "like", `%${textQuery}%`);
    }

    if (params.userId) {
      countQuery = countQuery.where((eb) =>
        eb.exists(
          eb
            .selectFrom("chart_room_users")
            .select("id")
            .whereRef("chart_room_users.roomId", "=", "chart_rooms.id")
            .where("chart_room_users.userId", "=", params.userId as string),
        ),
      );
    }

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    const entities = rows as ChatRoomEntity[];
    const roomIds = entities.map((room) => room.id);
    const membersMap = await this.getMembersCountMap(roomIds);

    return {
      items: entities.map((room) => this.toRoom(room, membersMap[room.id] ?? 0)),
      totalCount,
    };
  }

  async addRoomUser(roomId: ChatRoomId, userId: ChatUserId, role?: ChatRoomRole): Promise<void> {
    const room = await this.roomRepo.findById({ id: roomId });
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }

    const normalizedRole = this.normalizeRole(role);
    const now = new Date().toISOString();
    await this.createOrUpdateRoomUser(roomId, userId, normalizedRole, now);
    await this.roomRepo.update({ id: roomId }, { updatedAt: now });
  }

  async removeRoomUser(roomId: ChatRoomId, userId: ChatUserId): Promise<void> {
    await this.store.db
      .deleteFrom("chart_room_users")
      .where("roomId", "=", roomId)
      .where("userId", "=", userId)
      .execute();

    await this.roomRepo.update({ id: roomId }, { updatedAt: new Date().toISOString() });
  }

  async listRoomUsers(roomId: ChatRoomId): Promise<ChatRoomUser[]> {
    const rows = await this.store.db
      .selectFrom("chart_room_users")
      .selectAll()
      .where("roomId", "=", roomId)
      .orderBy("joinedAt", "asc")
      .execute();

    return (rows as ChatRoomUserEntity[]).map((row) => this.toRoomUser(row));
  }

  async listUserRooms(userId: ChatUserId, params: ChatRoomsListParams): Promise<ChatRoomsListResult> {
    return this.listRooms({
      ...params,
      userId,
    });
  }

  private async createOrUpdateRoomUser(
    roomId: ChatRoomId,
    userId: ChatUserId,
    role: ChatRoomRole,
    now: string,
  ): Promise<void> {
    const existing = await this.store.db
      .selectFrom("chart_room_users")
      .selectAll()
      .where("roomId", "=", roomId)
      .where("userId", "=", userId)
      .executeTakeFirst();

    if (existing) {
      await this.roomUserRepo.update({ id: (existing as ChatRoomUserEntity).id }, { role, updatedAt: now });
      return;
    }

    const entity: ChatRoomUserEntity = {
      id: generateULID(),
      roomId,
      userId,
      role,
      joinedAt: now,
      updatedAt: now,
    };

    await this.roomUserRepo.create(entity as any);
  }

  private normalizeRole(role?: ChatRoomRole): ChatRoomRole {
    if (role === "owner" || role === "admin" || role === "member") {
      return role;
    }
    return "member";
  }

  private async getMembersCountMap(roomIds: string[]): Promise<Record<string, number>> {
    if (roomIds.length === 0) {
      return {};
    }

    const rows = await this.store.db
      .selectFrom("chart_room_users")
      .select([
        "roomId",
        ({ fn }) => fn.countAll().as("count"),
      ])
      .where("roomId", "in", roomIds)
      .groupBy("roomId")
      .execute();

    const map: Record<string, number> = {};
    for (const row of rows as Array<{ roomId: string; count: number | string }>) {
      map[row.roomId] = Number(row.count ?? 0);
    }
    return map;
  }

  private toRoom(entity: ChatRoomEntity, membersCount: number): ChatRoom {
    return {
      id: entity.id,
      title: entity.title ?? undefined,
      description: entity.description ?? undefined,
      type: entity.type,
      threadId: entity.threadId,
      createdBy: entity.createdBy ?? undefined,
      archived: entity.archived === 1,
      processed: entity.processed === 1,
      flud: entity.flud === 1,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      membersCount,
    };
  }

  private toRoomUser(entity: ChatRoomUserEntity): ChatRoomUser {
    return {
      id: entity.id,
      roomId: entity.roomId,
      userId: entity.userId,
      role: this.normalizeRole(entity.role),
      joinedAt: entity.joinedAt,
      updatedAt: entity.updatedAt,
    };
  }
}
