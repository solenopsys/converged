import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import usersMigrations from "./stores/users/migrations";
import {
	normalizeLocale,
	normalizeScopedLayouts,
	UsersStoreService,
} from "./stores/users/service";

/**
 * The home screen and the bar inside every surface keep their pins the way the
 * strip does. What matters is that places do not overwrite each other, that
 * the strip stays one set of pins whichever method wrote it, and that clearing
 * a place does not leave an empty entry behind.
 */
describe("pins of every tabbed place", () => {
	let users: UsersStoreService;

	beforeEach(async () => {
		const store = new SqlStore(
			":memory:",
			usersMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		users = new UsersStoreService(store);
	});

	it("starts with no scoped layouts", async () => {
		expect((await users.get("anna")).layouts).toEqual([]);
	});

	it("keeps each place apart", async () => {
		await users.saveLayout("anna", "home", {
			pinned: ["sf-orders"],
			unpinned: [],
		});
		await users.saveLayout("anna", "menu:sf-orders", {
			pinned: ["view:orders.order.table", "op:orders.create"],
			unpinned: [],
		});
		await users.saveLayout("anna", "home", {
			pinned: ["sf-orders", "sf-team"],
			unpinned: [],
		});

		expect((await users.get("anna")).layouts).toEqual([
			{
				scope: "menu:sf-orders",
				pinned: ["view:orders.order.table", "op:orders.create"],
				unpinned: [],
			},
			{ scope: "home", pinned: ["sf-orders", "sf-team"], unpinned: [] },
		]);
		expect((await users.get("boris")).layouts).toEqual([]);
	});

	it("writes the strip through the same column saveSurfaceLayout uses", async () => {
		await users.saveLayout("anna", "surfaces", {
			pinned: ["sf-team"],
			unpinned: ["sf-logs"],
		});

		const anna = await users.get("anna");
		expect(anna.surfaces).toEqual({
			pinned: ["sf-team"],
			unpinned: ["sf-logs"],
		});
		expect(anna.layouts).toEqual([]);
	});

	it("drops a place once nothing is pinned in it", async () => {
		await users.saveLayout("anna", "home", {
			pinned: ["sf-orders"],
			unpinned: [],
		});
		await users.saveLayout("anna", "home", { pinned: [], unpinned: [] });

		expect((await users.get("anna")).layouts).toEqual([]);
	});

	it("cleans what the browser sent", () => {
		expect(
			normalizeScopedLayouts([
				{ scope: " home ", pinned: ["a", "a", 1], unpinned: ["a", "b"] },
				{ scope: "", pinned: ["x"], unpinned: [] },
				{ scope: "surfaces", pinned: ["x"], unpinned: [] },
				"junk",
			]),
		).toEqual([{ scope: "home", pinned: ["a"], unpinned: ["b"] }]);
		expect(normalizeScopedLayouts("junk")).toEqual([]);
	});

	it("remembers the language per user, and nothing that is not a language", async () => {
		expect((await users.get("anna")).locale).toBe("");
		await users.saveLocale("anna", "ru");
		await users.saveLayout("anna", "home", {
			pinned: ["sf-team"],
			unpinned: [],
		});

		expect((await users.get("anna")).locale).toBe("ru");
		expect((await users.get("boris")).locale).toBe("");
		expect(normalizeLocale(" pt-BR ")).toBe("pt-BR");
		expect(normalizeLocale("<script>")).toBe("");
	});
});
