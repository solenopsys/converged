import {
	AccessTags,
	applyKyselyFilter,
	generateULID,
	type KyselyFilterSchema,
	personalTag,
	type SqlStore,
	visibleFrom,
} from "back-core";
import type {
	ChatRoom,
	ChatRoomId,
	ChatRoomRole,
	ChatRoomsListParams,
	ChatRoomsListResult,
	ChatRoomUser,
	ChatUserId,
	CreateChatRoomInput,
	FilterObject,
	UpdateChatRoomInput,
	Visibility,
} from "../../types";

const chatFilterSchema: KyselyFilterSchema = {
	id: { valueType: "string", operators: ["eq", "in"], column: "obj.id" },
	title: {
		valueType: "string",
		operators: ["eq", "in", "contains", "startsWith", "isNull"],
		column: "obj.title",
	},
	type: {
		valueType: "string",
		operators: ["eq", "in", "notEq", "notIn"],
		column: "obj.type",
	},
	archived: {
		valueType: "boolean",
		operators: ["eq", "notEq"],
		column: "obj.archived",
	},
	processed: {
		valueType: "boolean",
		operators: ["eq", "notEq"],
		column: "obj.processed",
	},
	updatedAt: {
		valueType: "date",
		operators: ["gt", "gte", "lt", "lte", "between"],
		column: "obj.updatedAt",
	},
};

import {
	type ChatRoomEntity,
	ChatRoomRepository,
	type ChatRoomUserEntity,
	ChatRoomUserRepository,
} from "./entities";

export class ChatsStoreService {
	private readonly roomRepo: ChatRoomRepository;
	private readonly roomUserRepo: ChatRoomUserRepository;
	/**
	 * Who may see which room. Membership is mirrored here as the member's own
	 * tag, so the room list is a lookup by tag like every other list in the
	 * system, instead of an `EXISTS` over the membership table that the planner
	 * would have to run from the room side.
	 */
	readonly access: AccessTags;

	constructor(private store: SqlStore) {
		this.access = new AccessTags(store);
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

	/**
	 * Creates a room and mints its thread id.
	 *
	 * The thread id is generated here rather than accepted from the caller for
	 * the same reason the room id is: an id a client may choose is an id it may
	 * steal, and `access_tags` stores no object type to catch the collision. The
	 * thread itself is not registered here — that would be `rp-chats` calling
	 * `rp-threads`, and services do not call each other; the caller does it with
	 * the id this returns.
	 */
	async createRoom(
		input: CreateChatRoomInput,
		actor: string,
	): Promise<ChatRoom> {
		const roomId = generateULID();
		const now = new Date().toISOString();

		const roomEntity: ChatRoomEntity = {
			id: roomId,
			title: input.title ?? null,
			description: input.description ?? null,
			type: input.type,
			threadId: generateULID(),
			createdBy: actor,
			visibility: input.visibility ?? "tagged",
			archived: 0,
			processed: 0,
			flud: 0,
			createdAt: now,
			updatedAt: now,
		};

		await this.roomRepo.create(roomEntity as any);

		// The creator is always a member, whatever the caller listed: a room its
		// own owner cannot open is not a room.
		const userSet = new Set<string>([actor, ...(input.userIds ?? [])]);

		for (const userId of userSet) {
			const role: ChatRoomRole = userId === actor ? "owner" : "member";
			await this.createOrUpdateRoomUser(roomId, userId, role, now);
		}

		// Membership and visibility land in the same relation: each member's
		// personal tag, plus whatever the chosen visibility means. A `tagged` room —
		// the default — therefore carries exactly its members and nobody else.
		await this.access.tagNew(roomId, {
			visibility: roomEntity.visibility as Visibility,
			owner: actor,
			tags: [...userSet].map((userId) => personalTag(userId)),
		});

		const created = await this.getRoom(roomId);
		if (!created) {
			throw new Error(`Failed to create room: ${roomId}`);
		}

		return created;
	}

	/**
	 * A room the caller is not matched by reads as absent. Not "forbidden": that
	 * would confirm the room exists to anyone who guesses an id.
	 */
	async getRoom(roomId: ChatRoomId): Promise<ChatRoom | null> {
		if (!(await this.access.canRead(roomId))) return null;
		const room = await this.roomRepo.findById({ id: roomId });
		if (!room) return null;

		const counts = await this.getMembersCountMap([room.id]);
		return this.toRoom(room, counts[room.id] ?? 0);
	}

	async updateRoom(
		roomId: ChatRoomId,
		patch: UpdateChatRoomInput,
	): Promise<ChatRoom> {
		await this.access.requireWrite(roomId);
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
		if (patch.visibility !== undefined) {
			update.visibility = patch.visibility;
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
		if (patch.visibility !== undefined) {
			await this.access.setVisibility(roomId, patch.visibility as Visibility);
		}

		const updated = await this.getRoom(roomId);
		if (!updated) {
			throw new Error(`Failed to update room: ${roomId}`);
		}

		return updated;
	}

	async deleteRoom(roomId: ChatRoomId): Promise<boolean> {
		await this.access.requireWrite(roomId);
		await this.store.db
			.deleteFrom("chart_room_users")
			.where("roomId", "=", roomId)
			.execute();
		const deleted = await this.roomRepo.delete({ id: roomId });
		// Grants have to go with the room: the next ULID is not guessable, but a
		// tag row that outlives its object is a grant nobody can see or revoke.
		if (deleted) await this.access.dropObject(roomId);
		return deleted;
	}

	/**
	 * The rooms the caller may see, narrowed by tag.
	 *
	 * Membership used to be an `EXISTS` over `chart_room_users` — correct, but it
	 * made the planner start from `chart_rooms` and walk it. The same membership
	 * is now a tag on the room, so the query starts at the tag index and touches
	 * only rooms this caller is in, whatever the table holds. `params.userId` is
	 * long gone: the actor is the only source, and substituting an id read
	 * somebody else's rooms.
	 */
	private visibleRooms(params: {
		type?: ChatRoomsListParams["type"];
		archived?: boolean;
		processed?: boolean;
		query?: string;
		filter?: FilterObject;
	}) {
		let query = visibleFrom(this.store.db, "chart_rooms");

		if (params.type) {
			query = query.where("obj.type", "=", params.type);
		}
		if (params.archived !== undefined) {
			query = query.where("obj.archived", "=", params.archived ? 1 : 0);
		}
		if (params.processed !== undefined) {
			query = query.where("obj.processed", "=", params.processed ? 1 : 0);
		}

		const textQuery = params.query?.trim();
		if (textQuery) {
			query = query.where("obj.title", "like", `%${textQuery}%`);
		}

		return applyKyselyFilter(query, params.filter, chatFilterSchema);
	}

	async listRooms(params: ChatRoomsListParams): Promise<ChatRoomsListResult> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		const rows = await this.visibleRooms(params)
			.selectAll("obj")
			.orderBy("obj.updatedAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		const countResult = await this.visibleRooms(params)
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();

		const entities = rows as ChatRoomEntity[];
		const membersMap = await this.getMembersCountMap(
			entities.map((room) => room.id),
		);

		return {
			items: entities.map((room) =>
				this.toRoom(room, membersMap[room.id] ?? 0),
			),
			totalCount: Number(countResult?.count ?? 0),
		};
	}

	/**
	 * The count behind the selection UI, narrowed like every other read. It used
	 * to count every room in the store, which told any caller how many private
	 * conversations existed.
	 */
	async countRooms(filter?: FilterObject): Promise<number> {
		const result = await this.visibleRooms({ filter })
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();
		return Number(result?.count ?? 0);
	}

	async addRoomUser(
		roomId: ChatRoomId,
		userId: ChatUserId,
		role?: ChatRoomRole,
	): Promise<void> {
		const room = await this.roomRepo.findById({ id: roomId });
		if (!room) {
			throw new Error(`Room not found: ${roomId}`);
		}

		const normalizedRole = this.normalizeRole(role);
		const now = new Date().toISOString();
		await this.createOrUpdateRoomUser(roomId, userId, normalizedRole, now);
		// The row carries the role, the tag carries the access. Both, or the new
		// member is listed in the room they still cannot open.
		await this.access.grantToUser(roomId, userId);
		await this.roomRepo.update({ id: roomId }, { updatedAt: now });
	}

	async removeRoomUser(roomId: ChatRoomId, userId: ChatUserId): Promise<void> {
		await this.store.db
			.deleteFrom("chart_room_users")
			.where("roomId", "=", roomId)
			.where("userId", "=", userId)
			.execute();

		// Revocation is effective on the next request: this tag is read from the
		// table, not carried in anybody's token.
		await this.access.revokeFromUser(roomId, userId);

		await this.roomRepo.update(
			{ id: roomId },
			{ updatedAt: new Date().toISOString() },
		);
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

	/**
	 * True when `userId` is in the room, by the role table.
	 *
	 * Access is no longer asked this question — that is `access.canRead`, which
	 * answers for group grants and open rooms too. This remains for the places
	 * that mean membership itself: who gets the live update, who holds a role.
	 */
	async isRoomMember(roomId: ChatRoomId, userId: ChatUserId): Promise<boolean> {
		const row = await this.store.db
			.selectFrom("chart_room_users")
			.select("id")
			.where("roomId", "=", roomId)
			.where("userId", "=", userId)
			.executeTakeFirst();
		return Boolean(row);
	}

	/** The room's members, which is the audience a live update is addressed to. */
	async listRoomMemberIds(roomId: ChatRoomId): Promise<ChatUserId[]> {
		const rows = await this.store.db
			.selectFrom("chart_room_users")
			.select("userId")
			.where("roomId", "=", roomId)
			.execute();
		return (rows as Array<{ userId: string }>).map((row) => row.userId);
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
			await this.roomUserRepo.update(
				{ id: (existing as ChatRoomUserEntity).id },
				{ role, updatedAt: now },
			);
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

	private async getMembersCountMap(
		roomIds: string[],
	): Promise<Record<string, number>> {
		if (roomIds.length === 0) {
			return {};
		}

		const rows = await this.store.db
			.selectFrom("chart_room_users")
			.select(["roomId", ({ fn }) => fn.countAll().as("count")])
			.where("roomId", "in", roomIds)
			.groupBy("roomId")
			.execute();

		const map: Record<string, number> = {};
		for (const row of rows as Array<{
			roomId: string;
			count: number | string;
		}>) {
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
			visibility: (entity.visibility ?? "tagged") as Visibility,
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
