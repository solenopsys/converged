import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import threadIndexMigrations from "./stores/thread-index/migrations";
import { ThreadIndexStoreService } from "./stores/thread-index/service";

/**
 * `rp-threads` is the repository a browser talks to without anything in
 * between, so these are the checks standing between a guessed thread id and
 * somebody else's conversation. The thread defends itself: it never asks
 * `rp-chats` or `rp-community` who belongs to it, because it may not.
 */
describe("a thread defends itself", () => {
	let store: SqlStore;
	let index: ThreadIndexStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			threadIndexMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		index = new ThreadIndexStoreService(store);
	});

	it("lists a registered thread to its owner and to nobody else", async () => {
		await index.register("t-alice", "chat", { owner: "alice" });
		await index.register("t-bob", "chat", { owner: "bob" });

		const forAlice = await as("alice", () => index.list({}));
		expect(forAlice.items.map((t) => t.threadId)).toEqual(["t-alice"]);
		expect(forAlice.totalCount).toBe(1);
	});

	it("refuses a thread the caller holds no tag for", async () => {
		await index.register("t-alice", "chat", { owner: "alice" });
		expect(await as("bob", () => index.access.canRead("t-alice"))).toBe(false);
		await as("bob", async () => {
			expect(index.access.requireRead("t-alice")).rejects.toThrow(
				AccessDeniedError,
			);
		});
	});

	it("reads nothing at all for a thread that was never registered", async () => {
		// Failing closed is the point: an untagged thread predates the tags, and
		// guessing its id must not be enough.
		expect(await as("alice", () => index.access.canRead("t-unknown"))).toBe(
			false,
		);
	});

	it("gives the thread to a person it was granted to, at once", async () => {
		await index.register("t-alice", "chat", { owner: "alice" });
		expect(await as("bob", () => index.access.canRead("t-alice"))).toBe(false);

		await index.access.grantToUser("t-alice", "bob");
		expect(await as("bob", () => index.access.canRead("t-alice"))).toBe(true);
		expect((await as("bob", () => index.list({}))).totalCount).toBe(1);

		await index.access.revokeFromUser("t-alice", "bob");
		expect(await as("bob", () => index.access.canRead("t-alice"))).toBe(false);
	});

	it("opens a forum thread to everyone who is logged in when it says so", async () => {
		await index.register("t-topic", "forum", {
			owner: "alice",
			visibility: "authenticated",
		});
		expect(await as("stranger", () => index.access.canRead("t-topic"))).toBe(
			true,
		);
		// But it is still not theirs to delete or re-tag.
		expect(await as("stranger", () => index.access.canWrite("t-topic"))).toBe(
			false,
		);
	});

	it("claims a thread for whoever wrote to it first", async () => {
		await index.touch("t-new", "alice");
		expect(await as("alice", () => index.access.canRead("t-new"))).toBe(true);
		expect(await as("bob", () => index.access.canRead("t-new"))).toBe(false);
	});

	it("counts and sums only the caller's own threads", async () => {
		await index.register("t-alice", "chat", { owner: "alice" });
		await index.touch("t-alice", "alice");
		await index.register("t-bob", "audio", { owner: "bob" });
		await index.touch("t-bob", "bob");

		const forAlice = await as("alice", () => index.stats());
		expect(forAlice.total).toBe(1);
		expect(forAlice.totalMessages).toBe(1);
		expect(forAlice.byKind.chat).toBe(1);
		expect(forAlice.byKind.audio).toBe(0);

		expect(await as("dan", () => index.count())).toBe(0);
	});

	it("lets a team read a thread opened to its tag", async () => {
		await index.register("t-ticket", "chat", {
			owner: "alice",
			tags: ["team-support"],
		});
		const forAgent = await as("agent", () => index.list({}), ["team-support"]);
		expect(forAgent.items.map((t) => t.threadId)).toEqual(["t-ticket"]);
	});

	it("takes the grants away with the thread", async () => {
		await index.register("t-alice", "chat", { owner: "alice" });
		await index.delete("t-alice");
		expect(await index.access.tagsOf("t-alice")).toEqual([]);
	});
});
