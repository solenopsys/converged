import { Access, getCurrentWorkspaceContext } from "nrpc";
import { StoresController } from "./stores";
import type {
	ChatContext,
	ChatContextSummary,
	ChatRoom,
	ChatRoomId,
	ChatRoomRole,
	ChatRoomsListParams,
	ChatRoomsListResult,
	ChatRoomUser,
	ChatsService,
	ChatUserId,
	CreateChatRoomInput,
	FilterObject,
	PaginatedResult,
	PaginationParams,
	SelectionDescriptor,
	SelectionStats,
	UpdateChatRoomInput,
} from "./types";

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
	async updateRoom(
		roomId: ChatRoomId,
		patch: UpdateChatRoomInput,
	): Promise<ChatRoom> {
		await this.ready();
		return this.stores.chats.updateRoom(roomId, patch);
	}

	@Access("user")
	async deleteRoom(roomId: ChatRoomId): Promise<boolean> {
		await this.ready();
		return this.stores.chats.deleteRoom(roomId);
	}

	@Access("user")
	async listRooms(params: ChatRoomsListParams): Promise<ChatRoomsListResult> {
		await this.ready();
		return this.stores.chats.listRooms(params);
	}

	@Access("user")
	async describeSelection(objectType: string): Promise<SelectionDescriptor> {
		if (objectType !== "chats.chat")
			throw new Error(`Unsupported chat selection object: ${objectType}`);
		return {
			objectType,
			title: "Chats",
			fields: [
				{
					id: "title",
					label: "Room",
					valueType: "string",
					operators: ["eq", "in", "contains", "startsWith", "isNull"],
				},
				{
					id: "type",
					label: "Type",
					valueType: "enum",
					operators: ["eq", "in", "notEq", "notIn"],
				},
				{
					id: "archived",
					label: "Archived",
					valueType: "boolean",
					operators: ["eq", "notEq"],
				},
			],
			revision: "chats-v1",
		};
	}

	@Access("user")
	async inspectChats(filter?: FilterObject): Promise<SelectionStats> {
		await this.ready();
		return { totalCount: await this.stores.chats.countRooms(filter) };
	}

	@Access("user")
	async addRoomUser(
		roomId: ChatRoomId,
		userId: ChatUserId,
		role?: ChatRoomRole,
	): Promise<void> {
		await this.ready();
		await this.requireRoomWrite(roomId);
		return this.stores.chats.addRoomUser(roomId, userId, role);
	}

	@Access("user")
	async removeRoomUser(roomId: ChatRoomId, userId: ChatUserId): Promise<void> {
		await this.ready();
		await this.requireRoomWrite(roomId);
		return this.stores.chats.removeRoomUser(roomId, userId);
	}

	@Access("user")
	async listRoomUsers(roomId: ChatRoomId): Promise<ChatRoomUser[]> {
		await this.ready();
		await this.requireRoomRead(roomId);
		return this.stores.chats.listRoomUsers(roomId);
	}

	/**
	 * Reading a room is being matched by one of its tags — membership, since a
	 * member holds the room's `u-<id>` tag, but also a group the room was opened
	 * to, or `public` if it is an open room.
	 *
	 * `listRooms` does not call this: there the same rule is part of the query,
	 * which is what keeps `totalCount` honest.
	 */
	private async requireRoomRead(roomId: ChatRoomId): Promise<void> {
		requireActor();
		await this.stores.chats.access.requireRead(roomId);
	}

	/**
	 * Changing a room needs a tag of the caller's own. Being able to see an open
	 * room is not being able to rename it or evict its members.
	 */
	private async requireRoomWrite(roomId: ChatRoomId): Promise<void> {
		requireActor();
		await this.stores.chats.access.requireWrite(roomId);
	}

	// A context belongs to a room, so reading or writing one is a room operation
	// and answers to the room's tags. The file store keeps no tags of its own —
	// per `access-control.md`, the file name *is* the object id and the record
	// pointing at it is what carries the access; here that record is the room.
	@Access("user")
	async saveContext(
		chatId: string,
		context: any,
		language?: string,
	): Promise<ChatContextSummary> {
		await this.ready();
		await this.requireRoomWrite(chatId);
		return this.stores.contexts.saveContext(chatId, context, language);
	}

	@Access("user")
	async getContext(
		chatId: string,
		language?: string,
	): Promise<ChatContext | null> {
		await this.ready();
		await this.requireRoomRead(chatId);
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
