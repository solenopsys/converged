import { beforeEach, describe, expect, it } from "bun:test";
import { AccessDeniedError, InMemoryMigrationState, SqlStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import requestsMigrations from "./stores/requests/migrations";
import { RequestsStoreService } from "./stores/requests/service";

/**
 * A request is a customer enquiry with its fields and its audit trail, so it is
 * `private` at birth: the team that handles it gets a group tag, everyone else
 * gets nothing.
 */
describe("who sees which requests", () => {
	let store: SqlStore;
	let requests: RequestsStoreService;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			requestsMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		requests = new RequestsStoreService(store);
	});

	const file = (actor: string, source = "web") =>
		as(actor, () =>
			requests.createRequest({ source, fields: {} } as any, actor),
		);

	it("lists a request to whoever filed it and to nobody else", async () => {
		const mine = await file("alice");
		await file("bob");

		const forAlice = await as("alice", () => requests.listRequests({} as any));
		expect(forAlice.items.map((r) => r.id)).toEqual([mine]);
		expect(forAlice.totalCount).toBe(1);
		expect(await as("dan", () => requests.countRequests())).toBe(0);
	});

	it("hides a request and its audit trail from a stranger", async () => {
		const mine = await file("alice");
		expect(await as("bob", () => requests.getRequest(mine))).toBeUndefined();
		expect(
			await as("bob", () => requests.getRequestModel(mine)),
		).toBeUndefined();
		await as("bob", async () => {
			expect(requests.listProcessing(mine)).rejects.toThrow(AccessDeniedError);
		});
	});

	it("refuses a stranger's status change", async () => {
		const mine = await file("alice");
		await as("bob", async () => {
			expect(requests.updateStatus(mine, "done" as any, "bob")).rejects.toThrow(
				AccessDeniedError,
			);
		});
		expect(
			await as("alice", () =>
				requests.updateStatus(mine, "done" as any, "alice"),
			),
		).toBeUndefined();
	});

	it("does not let metrics count what the caller cannot see", async () => {
		await file("alice");
		await file("bob");
		await file("bob");

		expect((await as("alice", () => requests.getRequestMetrics())).total).toBe(
			1,
		);
		expect((await as("dan", () => requests.getRequestMetrics())).total).toBe(0);
	});

	it("opens a request to the team handling it through a group tag", async () => {
		const mine = await file("alice");
		await requests.access.grant(mine, "team-sales");

		const forAgent = await as("agent", () => requests.listRequests({} as any), [
			"team-sales",
		]);
		expect(forAgent.items.map((r) => r.id)).toEqual([mine]);
		expect(
			await as(
				"agent",
				() => requests.updateStatus(mine, "done" as any, "agent"),
				["team-sales"],
			),
		).toBeUndefined();
	});

	it("does not let a source filter reach across owners", async () => {
		await file("alice", "phone");
		const mine = await file("bob", "phone");

		const found = await as("bob", () =>
			requests.listRequests({ source: "phone" } as any),
		);
		expect(found.items.map((r) => r.id)).toEqual([mine]);
	});
});
