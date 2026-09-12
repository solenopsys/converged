import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import callsMigrations from "./stores/calls/migrations";
import { CallsStoreService } from "./stores/calls/service";

/**
 * A call record is a phone number, a title and a transcript, so an unnarrowed
 * list is the substance of every conversation in the deployment.
 */
describe("who may hear which calls", () => {
	let store: SqlStore;
	let calls: CallsStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	const kvStub = () =>
		({
			put: () => undefined,
			get: () => undefined,
			delete: () => undefined,
			listKeys: () => [] as string[],
		}) as any;

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			callsMigrations as any,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		calls = new CallsStoreService(store, kvStub(), kvStub());
	});

	const register = (id: string, actor: string, phone = "+700") =>
		as(actor, () =>
			calls.registerCall(
				{ callId: id, startedAt: Date.now(), phone } as any,
				actor,
			),
		);

	it("lists a call to its owner and to nobody else", async () => {
		await register("c1", "alice");
		await register("c2", "bob");

		const forAlice = await as("alice", () => calls.listCalls({} as any));
		expect(forAlice.items.map((c) => c.id)).toEqual(["c1"]);
		expect(forAlice.totalCount).toBe(1);
		expect(await as("dan", () => calls.countCalls())).toBe(0);
	});

	it("hides a call from a stranger who knows its id", async () => {
		await register("c1", "alice");
		expect(await as("bob", () => calls.getCall("c1"))).toBeUndefined();
		await as("bob", async () => {
			expect(calls.getDialogue("c1")).rejects.toThrow(AccessDeniedError);
			expect(calls.getCallAudio("c1", "user")).rejects.toThrow(
				AccessDeniedError,
			);
		});
		expect(await as("bob", () => calls.hasCallAudio("c1"))).toBe(false);
	});

	it("refuses to let a guessed call id be re-registered or edited", async () => {
		await register("c1", "alice");
		await as("bob", async () => {
			expect(
				calls.registerCall(
					{ callId: "c1", startedAt: 1, phone: "+7" } as any,
					"bob",
				),
			).rejects.toThrow(AccessDeniedError);
			expect(calls.updateCall("c1", { title: "mine" } as any)).rejects.toThrow(
				AccessDeniedError,
			);
			expect(calls.deleteCall("c1")).rejects.toThrow(AccessDeniedError);
		});
	});

	it("does not let a filter reach across owners", async () => {
		await register("c1", "alice", "+79001112233");
		await register("c2", "bob", "+79001112233");

		const found = await as("bob", () =>
			calls.listCalls({ phone: "+79001112233" } as any),
		);
		expect(found.items.map((c) => c.id)).toEqual(["c2"]);
		expect(found.totalCount).toBe(1);
	});

	it("lets a team hear a call opened to its tag", async () => {
		await register("c1", "alice");
		await calls.access.grant("c1", "team-quality");
		const forReviewer = await as("qa", () => calls.listCalls({} as any), [
			"team-quality",
		]);
		expect(forReviewer.items.map((c) => c.id)).toEqual(["c1"]);
	});

	it("takes the grants away with the call", async () => {
		await register("c1", "alice");
		await as("alice", () => calls.deleteCall("c1"));
		expect(await calls.access.tagsOf("c1")).toEqual([]);
	});
});
