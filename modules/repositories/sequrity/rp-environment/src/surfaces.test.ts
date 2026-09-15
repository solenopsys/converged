import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore, sql } from "back-core";
import usersMigrations from "./stores/users/migrations";
import {
	normalizeSurfaceLayout,
	UsersStoreService,
} from "./stores/users/service";

/**
 * Pinned surfaces are what a user gets back after a reload, so the questions
 * are whether they survive, whether they stay per person, and whether one bad
 * column can take the rest of the environment down with it.
 */
describe("pinned surfaces", () => {
	let store: SqlStore;
	let users: UsersStoreService;

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			usersMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		users = new UsersStoreService(store);
	});

	it("answers with an empty layout for someone who never pinned anything", async () => {
		expect((await users.get("anna")).surfaces).toEqual({
			pinned: [],
			unpinned: [],
		});
	});

	it("keeps the layout per user and leaves the rest of the environment alone", async () => {
		await users.saveCommandLayout("anna", {
			pinned: ["orders.create"],
			hidden: [],
			order: [],
		});
		await users.saveSurfaceLayout("anna", {
			pinned: ["sf-orders", "sf-equipment"],
			unpinned: ["sf-logs"],
		});

		const anna = await users.get("anna");
		expect(anna.surfaces).toEqual({
			pinned: ["sf-orders", "sf-equipment"],
			unpinned: ["sf-logs"],
		});
		expect(anna.commands.pinned).toEqual(["orders.create"]);
		expect((await users.get("boris")).surfaces.pinned).toEqual([]);
	});

	it("replaces the layout whole, so unpinning is a save and not a delete", async () => {
		await users.saveSurfaceLayout("anna", {
			pinned: ["sf-orders", "sf-team"],
			unpinned: [],
		});
		await users.saveSurfaceLayout("anna", {
			pinned: ["sf-team"],
			unpinned: ["sf-orders"],
		});
		expect((await users.get("anna")).surfaces).toEqual({
			pinned: ["sf-team"],
			unpinned: ["sf-orders"],
		});
	});

	it("cleans what the browser sent", () => {
		expect(
			normalizeSurfaceLayout({
				pinned: [" sf-orders ", "sf-orders", "", 42, "sf-team"],
				unpinned: ["sf-team", "sf-logs"],
			}),
		).toEqual({ pinned: ["sf-orders", "sf-team"], unpinned: ["sf-logs"] });
		expect(normalizeSurfaceLayout(null)).toEqual({ pinned: [], unpinned: [] });
		expect(normalizeSurfaceLayout({ pinned: "sf-orders" })).toEqual({
			pinned: [],
			unpinned: [],
		});
	});

	it("does not lose the pins when another column is damaged", async () => {
		await users.saveSurfaceLayout("anna", {
			pinned: ["sf-orders"],
			unpinned: [],
		});
		await sql`UPDATE user_environment SET windows = 'not json'`.execute(
			store.db,
		);

		const anna = await users.get("anna");
		expect(anna.windows).toEqual([]);
		expect(anna.surfaces.pinned).toEqual(["sf-orders"]);
	});
});
