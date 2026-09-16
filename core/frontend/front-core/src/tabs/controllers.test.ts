import { describe, expect, test } from "bun:test";
import { createEvent, createStore } from "effector";
import { createCatalogMenu, createContextMenu, createDropdown } from "./menus";
import type { CatalogItem } from "./model";
import { createTabBar } from "./tab-bar";
import { type Catalogs, createScopedTabSet, createTabSet } from "./tab-set";

const items: CatalogItem[] = [
	{ id: "orders", label: "Orders" },
	{ id: "clients", label: "Clients" },
	{ id: "create", label: "Create order", kind: "command" },
];

describe("a tab set", () => {
	test("reports what it evicted and which command was chosen", () => {
		const set = createTabSet({ name: "T1", $catalog: items });
		const evicted: string[][] = [];
		const commands: string[] = [];
		set.evicted.watch((ids) => evicted.push(ids));
		set.commandChosen.watch((id) => commands.push(id));

		set.opened("orders");
		set.opened("clients");
		set.opened("create");

		expect(set.$tabs.getState().map((tab) => tab.id)).toEqual(["clients"]);
		expect(evicted).toEqual([["orders"]]);
		expect(commands).toEqual(["create"]);
	});

	test("pins changes are reported as whole layouts, opening is not", () => {
		const set = createTabSet({ name: "T2", $catalog: items });
		const layouts: unknown[] = [];
		set.pinsChanged.watch((layout) => layouts.push(layout));

		set.opened("orders");
		set.pinToggled("orders");

		expect(layouts).toEqual([{ pinned: ["orders"], unpinned: [] }]);
	});

	test("the catalog is live: a pin waits for its item to appear", () => {
		const $catalog = createStore<readonly CatalogItem[]>([]);
		const installed = createEvent<CatalogItem>();
		$catalog.on(installed, (list, item) => [...list, item]);
		const set = createTabSet({ name: "T3", $catalog });

		set.layoutRestored({ pinned: ["sf-late"], unpinned: [] });
		expect(set.$tabs.getState()).toEqual([]);

		installed({ id: "sf-late", label: "Late" });
		expect(set.$tabs.getState().map((tab) => tab.id)).toEqual(["sf-late"]);
	});

	test("cleared drops the pins too; reset keeps them", () => {
		const set = createTabSet({ name: "T4", $catalog: items });
		set.opened("orders");
		set.pinToggled("orders");
		set.opened("clients");

		set.reset();
		expect(set.$tabs.getState().map((tab) => tab.id)).toEqual(["orders"]);

		set.cleared();
		expect(set.$tabs.getState()).toEqual([]);
	});
});

describe("a scoped tab set", () => {
	test("keeps one place per scope and draws the current one", () => {
		const $scope = createStore<string | null>("a");
		const scopeChanged = createEvent<string | null>();
		$scope.on(scopeChanged, (_, scope) => scope);
		const catalogs: Catalogs = { a: items, b: items };
		const sets = createScopedTabSet({
			name: "S1",
			$catalogs: createStore(catalogs),
			$scope,
		});

		sets.current.opened("orders");
		sets.open({ scope: "b", id: "clients" });

		expect(sets.current.$active.getState()).toBe("orders");
		scopeChanged("b");
		expect(sets.current.$active.getState()).toBe("clients");
		expect(sets.current.$tabs.getState().map((tab) => tab.id)).toEqual([
			"clients",
		]);
	});

	test("forgetting a scope keeps its pins", () => {
		const sets = createScopedTabSet({
			name: "S2",
			$catalogs: createStore<Catalogs>({ a: items }),
			$scope: createStore<string | null>("a"),
		});
		sets.current.opened("orders");
		sets.current.pinToggled("orders");
		sets.current.opened("clients");

		sets.scopesForgotten(["a"]);

		expect(sets.$states.getState().a?.active).toBeNull();
		expect(sets.$layouts.getState().a).toEqual({
			pinned: ["orders"],
			unpinned: [],
		});
	});

	test("with no scope, bound events do nothing", () => {
		const sets = createScopedTabSet({
			name: "S3",
			$catalogs: createStore<Catalogs>({ a: items }),
			$scope: createStore<string | null>(null),
		});
		sets.current.opened("orders");
		expect(sets.$states.getState()).toEqual({});
	});
});

describe("menus", () => {
	test("a dropdown opens, closes and toggles", () => {
		const menu = createDropdown("D1");
		menu.toggled();
		expect(menu.$open.getState()).toBe(true);
		menu.closed();
		expect(menu.$open.getState()).toBe(false);
	});

	test("the + menu filters, moves the highlight with wrap-around, and chooses", () => {
		const menu = createCatalogMenu({
			name: "C1",
			$items: createStore<readonly CatalogItem[]>(items),
		});
		const chosen: string[] = [];
		menu.chosen.watch((id) => chosen.push(id));

		menu.opened();
		menu.highlightMoved(-1);
		expect(menu.$highlight.getState()).toBe(2);

		menu.queryChanged("ord");
		expect(menu.$visible.getState().map((item) => item.id)).toEqual([
			"orders",
			"create",
		]);
		expect(menu.$highlight.getState()).toBe(0);

		menu.highlightMoved(1);
		menu.confirmed();
		expect(chosen).toEqual(["create"]);
		expect(menu.$open.getState()).toBe(false);
		// Reopened later, it starts from the whole catalog.
		expect(menu.$query.getState()).toBe("");
	});

	test("a context menu hands the action over with the item it was opened for", () => {
		const menu = createContextMenu("X1");
		const invoked: unknown[] = [];
		menu.invoked.watch((payload) => invoked.push(payload));

		menu.openedAt({ id: "orders", x: 10, y: 20 });
		menu.chosen("refresh");

		expect(invoked).toEqual([{ id: "orders", actionId: "refresh" }]);
		expect(menu.$target.getState()).toBeNull();
	});
});

describe("a tab bar", () => {
	const labels = () => ({ pin: "Pin", unpin: "Unpin", close: "Close" });

	test("choosing in + opens; pin and close from the context menu act on the set", () => {
		const set = createTabSet({ name: "B1", $catalog: items });
		const bar = createTabBar({ name: "B1_BAR", set, labels });

		bar.add.opened();
		bar.add.chosen("orders");
		expect(set.$active.getState()).toBe("orders");

		bar.context.openedAt({ id: "orders", x: 0, y: 0 });
		bar.context.chosen("pin");
		expect(set.$tabs.getState()[0]?.pinned).toBe(true);
		expect(
			bar.$actions.getState().orders?.map((action) => action.label),
		).toEqual(["Unpin", "Close"]);

		bar.context.openedAt({ id: "orders", x: 0, y: 0 });
		bar.context.chosen("close");
		expect(set.$tabs.getState()).toEqual([]);
	});

	test("an extra action reaches the owner, pin and close do not", () => {
		const set = createTabSet({ name: "B2", $catalog: items });
		const bar = createTabBar({
			name: "B2_BAR",
			set,
			labels,
			$extraActions: createStore(() => [{ id: "refresh", label: "Refresh" }]),
		});
		const invoked: unknown[] = [];
		bar.actionInvoked.watch((payload) => invoked.push(payload));

		set.opened("orders");
		bar.context.openedAt({ id: "orders", x: 0, y: 0 });
		bar.context.chosen("pin");
		bar.context.openedAt({ id: "orders", x: 0, y: 0 });
		bar.context.chosen("refresh");

		expect(invoked).toEqual([{ id: "orders", actionId: "refresh" }]);
	});
});
