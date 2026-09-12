import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import communityMigrations from "./stores/community/migrations";
import { CommunityStoreService } from "./stores/community/service";

/**
 * The visibility matrix of `community.md` §5.4, on the forum half of it.
 *
 * These are about who gets which rows, not about whether the query is fast —
 * the plan is asserted once, in `back-core`, for every table that uses it.
 */
describe("who sees which topics", () => {
	let store: SqlStore;
	let community: CommunityStoreService;

	const asAlice = <T>(fn: () => T) =>
		runWithWorkspaceContext({ user: "alice" }, fn);
	const asBob = <T>(fn: () => T) =>
		runWithWorkspaceContext({ user: "bob" }, fn);
	const asModerator = <T>(fn: () => T) =>
		runWithWorkspaceContext(
			{ user: "mod", accessTags: ["team-moderators"] },
			fn,
		);
	const anonymous = <T>(fn: () => T) => runWithWorkspaceContext({}, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			communityMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		community = new CommunityStoreService(store);
	});

	async function section(
		slug: string,
		visibility: "public" | "authenticated" | "private" | "tagged",
		owner: string,
	) {
		return runWithWorkspaceContext({ user: owner }, () =>
			community.saveSection({ slug, title: slug, visibility } as any, owner),
		);
	}

	it("keeps a private section out of a stranger's list and out of its total", async () => {
		const open = await section("open", "authenticated", "alice");
		const closed = await section("closed", "private", "alice");

		const forBob = await asBob(() => community.listSections({} as any));
		expect(forBob.items.map((row) => row.id)).toEqual([open]);
		expect(forBob.totalCount).toBe(1);

		const forAlice = await asAlice(() => community.listSections({} as any));
		expect(forAlice.items.map((row) => row.id).sort()).toEqual(
			[open, closed].sort(),
		);
		expect(forAlice.totalCount).toBe(2);
	});

	it("shows an anonymous reader public sections only", async () => {
		const open = await section("open", "public", "alice");
		await section("members", "authenticated", "alice");

		const page = await anonymous(() => community.listSections({} as any));
		expect(page.items.map((row) => row.id)).toEqual([open]);
	});

	it("gives a private section's topics the same audience as the section", async () => {
		const closed = await section("closed", "private", "alice");
		const topic = await asAlice(() =>
			community.createTopic(
				{ sectionId: closed, title: "plans" } as any,
				"alice",
			),
		);

		expect(await asBob(() => community.readTopic(topic.id))).toBeNull();
		expect(
			(await asBob(() => community.listTopics({} as any))).totalCount,
		).toBe(0);

		const forAlice = await asAlice(() => community.listTopics({} as any));
		expect(forAlice.items.map((row) => row.id)).toEqual([topic.id]);
	});

	it("refuses to start a topic in a section the caller cannot see", async () => {
		const closed = await section("closed", "private", "alice");
		expect(
			asBob(() =>
				community.createTopic({ sectionId: closed, title: "hi" } as any, "bob"),
			),
		).rejects.toThrow(AccessDeniedError);
	});

	it("lets a reader read but not edit someone else's open topic", async () => {
		const open = await section("open", "authenticated", "alice");
		const topic = await asAlice(() =>
			community.createTopic(
				{ sectionId: open, title: "hello" } as any,
				"alice",
			),
		);

		expect((await asBob(() => community.readTopic(topic.id)))?.title).toBe(
			"hello",
		);
		expect(
			asBob(() =>
				community.saveTopic(
					{
						id: topic.id,
						sectionId: open,
						threadId: topic.threadId,
						title: "edited",
					} as any,
					"bob",
				),
			),
		).rejects.toThrow(AccessDeniedError);
		expect(asBob(() => community.deleteTopic(topic.id))).rejects.toThrow(
			AccessDeniedError,
		);
	});

	it("lets a moderator edit through a group tag the section was opened to", async () => {
		const open = await section("open", "authenticated", "alice");
		await community.access.grant(open, "team-moderators");
		const topic = await asAlice(() =>
			community.createTopic(
				{ sectionId: open, title: "hello" } as any,
				"alice",
			),
		);

		// The topic inherited the section's tags, moderators' among them.
		expect(await asModerator(() => community.access.canWrite(topic.id))).toBe(
			true,
		);
		expect(await asModerator(() => community.deleteTopic(topic.id))).toBe(true);
	});

	it("stops listing a topic the moment its visibility is narrowed", async () => {
		const open = await section("open", "authenticated", "alice");
		const topic = await asAlice(() =>
			community.createTopic({ sectionId: open, title: "oops" } as any, "alice"),
		);
		expect(
			(await asBob(() => community.listTopics({} as any))).totalCount,
		).toBe(1);

		await asAlice(() =>
			community.saveTopic(
				{
					id: topic.id,
					sectionId: open,
					threadId: topic.threadId,
					title: "oops",
					visibility: "private",
				} as any,
				"alice",
			),
		);

		expect(
			(await asBob(() => community.listTopics({} as any))).totalCount,
		).toBe(0);
		expect(
			(await asAlice(() => community.listTopics({} as any))).totalCount,
		).toBe(1);
	});

	it("applies the client filter on top of access, never instead of it", async () => {
		const open = await section("open", "authenticated", "alice");
		const mine = await asAlice(() =>
			community.createTopic(
				{ sectionId: open, title: "shared" } as any,
				"alice",
			),
		);
		const closed = await section("closed", "private", "alice");
		const hidden = await asAlice(() =>
			community.createTopic(
				{ sectionId: closed, title: "shared" } as any,
				"alice",
			),
		);

		const page = await asBob(() =>
			community.listTopics({
				filter: { title: { eq: "shared" } },
			} as any),
		);
		expect(page.items.map((row) => row.id)).toEqual([mine.id]);
		expect(page.items.map((row) => row.id)).not.toContain(hidden.id);
		expect(
			await asBob(() =>
				community.countTopics({ title: { eq: "shared" } } as any),
			),
		).toBe(1);
	});

	it("drops the tags of everything a deleted section cascades over", async () => {
		const parent = await section("parent", "authenticated", "alice");
		const topic = await asAlice(() =>
			community.createTopic(
				{ sectionId: parent, title: "doomed" } as any,
				"alice",
			),
		);

		await asAlice(() => community.deleteSection(parent));

		expect(await community.access.tagsOf(parent)).toEqual([]);
		expect(await community.access.tagsOf(topic.id)).toEqual([]);
	});
});
