import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import metadataMigrations from "./stores/metadata/migrations";
import { MedatataStoreService } from "./stores/metadata/service";

/**
 * One conversation per person, per `access-control.md`. The listing used to
 * hand every row to every caller, and a conversation's title is most of what
 * the conversation was about.
 */
describe("who sees which conversations", () => {
	let store: SqlStore;
	let metadata: MedatataStoreService;

	const as = <T>(user: string, fn: () => T) =>
		runWithWorkspaceContext({ user }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			metadataMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		metadata = new MedatataStoreService(store);
	});

	it("lists a conversation to its owner only", async () => {
		await metadata.registerConversation("t-1", "taxes", "alice");
		await metadata.registerConversation("t-2", "holiday", "bob");

		const forAlice = await as("alice", () =>
			metadata.listConversations({ limit: 10, offset: 0 }),
		);
		expect(forAlice.map((row: any) => row.id)).toEqual(["t-1"]);
		expect(await as("alice", () => metadata.countConversations())).toBe(1);
		expect(await as("dan", () => metadata.countConversations())).toBe(0);
	});

	it("refuses to let a guessed thread id take over someone's conversation", async () => {
		await metadata.registerConversation("t-1", "taxes", "alice");
		await as("bob", async () => {
			expect(
				metadata.registerConversation("t-1", "mine now", "bob"),
			).rejects.toThrow(AccessDeniedError);
			expect(metadata.recordMessage("t-1", "bob")).rejects.toThrow(
				AccessDeniedError,
			);
		});
	});

	it("does not let the name filter reach across owners", async () => {
		await metadata.registerConversation("t-1", "budget", "alice");
		await metadata.registerConversation("t-2", "budget", "bob");

		const found = await as("bob", () =>
			metadata.listConversations({
				limit: 10,
				offset: 0,
				filter: { name: { contains: "budget" } },
			}),
		);
		expect(found.map((row: any) => row.id)).toEqual(["t-2"]);
	});

	it("claims a conversation for whoever first recorded into it", async () => {
		await metadata.recordMessage("t-new", "alice");
		expect(await as("alice", () => metadata.access.canRead("t-new"))).toBe(
			true,
		);
		expect(await as("bob", () => metadata.access.canRead("t-new"))).toBe(false);
	});
});
