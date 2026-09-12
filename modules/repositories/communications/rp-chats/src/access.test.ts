import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import chatsMigrations from "./stores/chats/migrations";
import { ChatsStoreService } from "./stores/chats/service";

/**
 * The chat half of the `community.md` §5.4 matrix: a member sees their rooms, a
 * stranger sees neither the room nor the fact that it exists.
 */
describe("who sees which rooms", () => {
	let store: SqlStore;
	let chats: ChatsStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			chatsMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		chats = new ChatsStoreService(store);
	});

	const room = (owner: string, input: Record<string, unknown> = {}) =>
		as(owner, () =>
			chats.createRoom(
				{ type: "group", title: "room", ...input } as any,
				owner,
			),
		);

	it("lists a room to its members and to nobody else", async () => {
		const mine = await room("alice", { userIds: ["bob"] });
		await room("carol");

		const forBob = await as("bob", () => chats.listRooms({} as any));
		expect(forBob.items.map((r) => r.id)).toEqual([mine.id]);
		expect(forBob.totalCount).toBe(1);

		const forDan = await as("dan", () => chats.listRooms({} as any));
		expect(forDan.items).toHaveLength(0);
		expect(forDan.totalCount).toBe(0);
	});

	it("hides a room from a stranger who knows its id", async () => {
		const mine = await room("alice");
		expect(await as("dan", () => chats.getRoom(mine.id))).toBeNull();
		expect((await as("alice", () => chats.getRoom(mine.id)))?.id).toBe(mine.id);
	});

	it("does not let the selection count leak private rooms", async () => {
		await room("alice");
		await room("carol");
		expect(await as("alice", () => chats.countRooms())).toBe(1);
		expect(await as("dan", () => chats.countRooms())).toBe(0);
	});

	it("opens the room to a member the moment they are added, and closes it on removal", async () => {
		const mine = await room("alice");
		expect(await as("bob", () => chats.getRoom(mine.id))).toBeNull();

		await as("alice", () => chats.addRoomUser(mine.id, "bob"));
		expect((await as("bob", () => chats.getRoom(mine.id)))?.id).toBe(mine.id);

		await as("alice", () => chats.removeRoomUser(mine.id, "bob"));
		expect(await as("bob", () => chats.getRoom(mine.id))).toBeNull();
		// The role row went too — both carriers stay in step.
		expect(await chats.isRoomMember(mine.id, "bob")).toBe(false);
	});

	it("refuses a stranger's write even when the room is public to read", async () => {
		const open = await room("alice", { visibility: "public" });
		expect((await as("dan", () => chats.getRoom(open.id)))?.id).toBe(open.id);
		expect(
			as("dan", () => chats.updateRoom(open.id, { title: "hijacked" } as any)),
		).rejects.toThrow(AccessDeniedError);
		expect(as("dan", () => chats.deleteRoom(open.id))).rejects.toThrow(
			AccessDeniedError,
		);
	});

	it("narrowing a room's visibility drops it from outsiders' lists", async () => {
		const open = await room("alice", { visibility: "public" });
		expect((await as("dan", () => chats.listRooms({} as any))).totalCount).toBe(
			1,
		);

		await as("alice", () =>
			chats.updateRoom(open.id, { visibility: "tagged" } as any),
		);
		expect((await as("dan", () => chats.listRooms({} as any))).totalCount).toBe(
			0,
		);
		expect(
			(await as("alice", () => chats.listRooms({} as any))).totalCount,
		).toBe(1);
	});

	it("lets a team see a room opened to its group tag", async () => {
		const mine = await room("alice");
		await chats.access.grant(mine.id, "team-support");

		const forAgent = await as("agent", () => chats.listRooms({} as any), [
			"team-support",
		]);
		expect(forAgent.items.map((r) => r.id)).toEqual([mine.id]);
	});

	it("takes the grants away with the room", async () => {
		const mine = await room("alice", { userIds: ["bob"] });
		await as("alice", () => chats.deleteRoom(mine.id));
		expect(await chats.access.tagsOf(mine.id)).toEqual([]);
	});
});
