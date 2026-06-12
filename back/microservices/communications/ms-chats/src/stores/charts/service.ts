import { SqlStore, generateULID } from "back-core";
import type {
  ChartRoom,
  ChartRoomId,
  ChartRoomRole,
  ChartRoomsListParams,
  ChartRoomsListResult,
  ChartRoomUser,
  ChartUserId,
  CreateChartRoomInput,
  UpdateChartRoomInput,
} from "../../types";
import {
  ChartRoomRepository,
  ChartRoomUserRepository,
  type ChartRoomEntity,
  type ChartRoomUserEntity,
} from "./entities";

export class ChartsStoreService {
  private readonly roomRepo: ChartRoomRepository;
  private readonly roomUserRepo: ChartRoomUserRepository;

  constructor(private store: SqlStore) {
    this.roomRepo = new ChartRoomRepository(store, "chart_rooms", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });

    this.roomUserRepo = new ChartRoomUserRepository(store, "chart_room_users", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async createRoom(input: CreateChartRoomInput): Promise<ChartRoom> {
    const roomId = generateULID();
    const now = new Date().toISOString();

    const roomEntity: ChartRoomEntity = {
      id: roomId,
      title: input.title ?? null,
      type: input.type,
      threadId: input.threadId,
      createdBy: input.createdBy ?? null,
      archived: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.roomRepo.create(roomEntity as any);

    const userSet = new Set<string>(input.userIds ?? []);
    if (input.createdBy) {
      userSet.add(input.createdBy);
    }

    for (const userId of userSet) {
      const role: ChartRoomRole = input.createdBy && userId === input.createdBy ? "owner" : "member";
      await this.createOrUpdateRoomUser(roomId, userId, role, now);
    }

    const created = await this.getRoom(roomId);
    if (!created) {
      throw new Error(`Failed to create room: ${roomId}`);
    }

    return created;
  }

  async getRoom(roomId: ChartRoomId): Promise<ChartRoom | null> {
    const room = await this.roomRepo.findById({ id: roomId });
    if (!room) return null;

    const counts = await this.getMembersCountMap([room.id]);
    return this.toRoom(room, counts[room.id] ?? 0);
  }

  async updateRoom(roomId: ChartRoomId, patch: UpdateChartRoomInput): Promise<ChartRoom> {
    const existing = await this.roomRepo.findById({ id: roomId });
    if (!existing) {
      throw new Error(`Room not found: ${roomId}`);
    }

    const update: Partial<ChartRoomEntity> = {
      updatedAt: new Date().toISOString(),
    };

    if (patch.title !== undefined) {
      update.title = patch.title ?? null;
    }
    if (patch.threadId !== undefined) {
      update.threadId = patch.threadId;
    }
    if (patch.archived !== undefined) {
      update.archived = patch.archived ? 1 : 0;
    }

    await this.roomRepo.update({ id: roomId }, update);

    const updated = await this.getRoom(roomId);
    if (!updated) {
      throw new Error(`Failed to update room: ${roomId}`);
    }

    return updated;
  }

  async deleteRoom(roomId: ChartRoomId): Promise<boolean> {
    await this.store.db.deleteFrom("chart_room_users").where("roomId", "=", roomId).execute();
    return this.roomRepo.delete({ id: roomId });
  }

  async listRooms(params: ChartRoomsListParams): Promise<ChartRoomsListResult> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("chart_rooms").selectAll();

    if (params.type) {
      query = query.where("type", "=", params.type);
    }
    if (params.archived !== undefined) {
      query = query.where("archived", "=", params.archived ? 1 : 0);
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

    const entities = rows as ChartRoomEntity[];
    const roomIds = entities.map((room) => room.id);
    const membersMap = await this.getMembersCountMap(roomIds);

    return {
      items: entities.map((room) => this.toRoom(room, membersMap[room.id] ?? 0)),
      totalCount,
    };
  }

  async addRoomUser(roomId: ChartRoomId, userId: ChartUserId, role?: ChartRoomRole): Promise<void> {
    const room = await this.roomRepo.findById({ id: roomId });
    if (!room) {
      throw new Error(`Room not found: ${roomId}`);
    }

    const normalizedRole = this.normalizeRole(role);
    const now = new Date().toISOString();
    await this.createOrUpdateRoomUser(roomId, userId, normalizedRole, now);
    await this.roomRepo.update({ id: roomId }, { updatedAt: now });
  }

  async removeRoomUser(roomId: ChartRoomId, userId: ChartUserId): Promise<void> {
    await this.store.db
      .deleteFrom("chart_room_users")
      .where("roomId", "=", roomId)
      .where("userId", "=", userId)
      .execute();

    await this.roomRepo.update({ id: roomId }, { updatedAt: new Date().toISOString() });
  }

  async listRoomUsers(roomId: ChartRoomId): Promise<ChartRoomUser[]> {
    const rows = await this.store.db
      .selectFrom("chart_room_users")
      .selectAll()
      .where("roomId", "=", roomId)
      .orderBy("joinedAt", "asc")
      .execute();

    return (rows as ChartRoomUserEntity[]).map((row) => this.toRoomUser(row));
  }

  async listUserRooms(userId: ChartUserId, params: ChartRoomsListParams): Promise<ChartRoomsListResult> {
    return this.listRooms({
      ...params,
      userId,
    });
  }

  private async createOrUpdateRoomUser(
    roomId: ChartRoomId,
    userId: ChartUserId,
    role: ChartRoomRole,
    now: string,
  ): Promise<void> {
    const existing = await this.store.db
      .selectFrom("chart_room_users")
      .selectAll()
      .where("roomId", "=", roomId)
      .where("userId", "=", userId)
      .executeTakeFirst();

    if (existing) {
      await this.roomUserRepo.update({ id: (existing as ChartRoomUserEntity).id }, { role, updatedAt: now });
      return;
    }

    const entity: ChartRoomUserEntity = {
      id: generateULID(),
      roomId,
      userId,
      role,
      joinedAt: now,
      updatedAt: now,
    };

    await this.roomUserRepo.create(entity as any);
  }

  private normalizeRole(role?: ChartRoomRole): ChartRoomRole {
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

  private toRoom(entity: ChartRoomEntity, membersCount: number): ChartRoom {
    return {
      id: entity.id,
      title: entity.title ?? undefined,
      type: entity.type,
      threadId: entity.threadId,
      createdBy: entity.createdBy ?? undefined,
      archived: entity.archived === 1,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      membersCount,
    };
  }

  private toRoomUser(entity: ChartRoomUserEntity): ChartRoomUser {
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
