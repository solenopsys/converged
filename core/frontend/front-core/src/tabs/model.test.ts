import { describe, expect, test } from "bun:test";
import {
	type CatalogItem,
	catalogEntries,
	closeTab,
	defaultTabSetOptions,
	emptyTabSet,
	layoutOf,
	matchesQuery,
	mergeLayouts,
	openTab,
	resetTabSet,
	restoreLayout,
	type TabSetOptions,
	type TabSetState,
	tabViews,
	togglePin,
	visibleIds,
} from "./model";

const catalog: CatalogItem[] = [
	{ id: "overview", label: "Overview" },
	{ id: "orders", label: "Orders", group: "Views" },
	{ id: "clients", label: "Clients", group: "Views" },
	{ id: "create", label: "Create order", kind: "command", group: "Commands" },
	{ id: "suggested", label: "Suggested", pinned: true },
];

const transient = defaultTabSetOptions;
const board: TabSetOptions = { transient: false, home: null };
const withHome: TabSetOptions = { transient: true, home: "overview" };

function run(
	steps: Array<(state: TabSetState) => { state: TabSetState }>,
	state: TabSetState = emptyTabSet,
): TabSetState {
	return steps.reduce((current, step) => step(current).state, state);
}

const open =
	(id: string, options = transient) =>
	(state: TabSetState) =>
		openTab(state, catalog, id, undefined, options);
const pin =
	(id: string, options = transient) =>
	(state: TabSetState) =>
		togglePin(state, catalog, id, options);

describe("one transient tab", () => {
	test("configuration's suggestion is on screen before anything is opened", () => {
		expect(visibleIds(emptyTabSet, catalog)).toEqual(["suggested"]);
	});

	test("opening something else replaces the transient tab instead of adding one", () => {
		const first = openTab(emptyTabSet, catalog, "orders", undefined, transient);
		const second = openTab(
			first.state,
			catalog,
			"clients",
			undefined,
			transient,
		);

		expect(visibleIds(second.state, catalog)).toEqual(["suggested", "clients"]);
		expect(second.evicted).toEqual(["orders"]);
		expect(second.state.active).toBe("clients");
	});

	test("opening what is already on screen only activates it", () => {
		const state = run([open("orders"), open("suggested")]);
		const again = openTab(state, catalog, "orders", undefined, transient);

		expect(again.evicted).toEqual([]);
		expect(again.state.active).toBe("orders");
	});

	test("pinning keeps a tab, and the next opening no longer evicts it", () => {
		const state = run([open("orders"), pin("orders"), open("clients")]);

		expect(visibleIds(state, catalog)).toEqual([
			"suggested",
			"orders",
			"clients",
		]);
		expect(state.transient).toBe("clients");
	});

	test("unpinning the active tab leaves it on screen as the transient one", () => {
		const state = run([
			open("orders"),
			pin("orders"),
			open("clients"),
			open("orders"),
		]);
		const step = togglePin(state, catalog, "orders", transient);

		expect(step.evicted).toEqual(["clients"]);
		expect(step.state.transient).toBe("orders");
		expect(visibleIds(step.state, catalog)).toEqual(["suggested", "orders"]);
	});

	test("unpinning a tab in the background takes it off the screen", () => {
		const state = run([open("orders"), pin("orders"), open("clients")]);
		const step = togglePin(state, catalog, "orders", transient);

		expect(step.evicted).toEqual(["orders"]);
		expect(visibleIds(step.state, catalog)).toEqual(["suggested", "clients"]);
	});

	test("unpinning what configuration pins is remembered as an override", () => {
		const state = run([pin("suggested")]);

		expect(state.pins).toEqual({ suggested: false });
		expect(layoutOf(state)).toEqual({ pinned: [], unpinned: ["suggested"] });
	});

	test("a command is chosen, never opened", () => {
		const step = openTab(emptyTabSet, catalog, "create", undefined, transient);

		expect(step.command).toBe("create");
		expect(step.state).toBe(emptyTabSet);
	});

	test("something the catalog does not list is opened under its own label", () => {
		const step = openTab(
			emptyTabSet,
			catalog,
			"object:order:42",
			{ id: "object:order:42", label: "Order 42", icon: "Form" },
			transient,
		);
		const tab = tabViews(step.state, catalog).at(-1);

		expect(tab).toMatchObject({
			id: "object:order:42",
			label: "Order 42",
			active: true,
		});

		// Evicted, its label goes with it.
		const next = openTab(step.state, catalog, "orders", undefined, transient);
		expect(next.state.entries).toEqual({});
	});
});

describe("closing", () => {
	test("closing the active tab goes home, not to a neighbour", () => {
		const state = run([
			open("overview", withHome),
			pin("overview", withHome),
			open("orders", withHome),
		]);
		const step = closeTab(state, catalog, "orders", withHome);

		expect(step.state.active).toBe("overview");
		expect(step.evicted).toEqual(["orders"]);
	});

	test("closing a record returns to the projection that opened it", () => {
		const projection = "view:mailing.mail.incoming";
		const state = openTab(
			emptyTabSet,
			[...catalog, { id: projection, label: "Incoming mail" }],
			projection,
			undefined,
			withHome,
		).state;
		const record = openTab(
			state,
			[...catalog, { id: projection, label: "Incoming mail" }],
			"mail:655321",
			{ id: "mail:655321", label: "Mail[655321]" },
			withHome,
		);
		const closed = closeTab(
			record.state,
			[...catalog, { id: projection, label: "Incoming mail" }],
			"mail:655321",
			withHome,
		);

		expect(closed.state.active).toBe(projection);
		expect(closed.state.transient).toBe(projection);
		expect(closed.evicted).toEqual(["mail:655321"]);
	});

	test("home the user never pinned comes back as the transient tab", () => {
		const state = run([open("orders", withHome)]);
		const step = closeTab(state, catalog, "orders", withHome);

		expect(step.state.active).toBe("overview");
		expect(step.state.transient).toBe("overview");
	});

	test("closing a pinned tab unpins it", () => {
		const state = run([open("orders"), pin("orders")]);
		const step = closeTab(state, catalog, "orders", transient);

		expect(step.pinsChanged).toBe(true);
		expect(layoutOf(step.state).pinned).toEqual([]);
	});

	test("closing something not on screen changes nothing", () => {
		const step = closeTab(emptyTabSet, catalog, "orders", transient);
		expect(step.state).toBe(emptyTabSet);
		expect(step.evicted).toEqual([]);
	});
});

describe("a board without a transient slot", () => {
	test("opening pins, closing unpins", () => {
		const opened = openTab(emptyTabSet, catalog, "orders", undefined, board);
		expect(opened.pinsChanged).toBe(true);
		expect(visibleIds(opened.state, catalog)).toEqual(["suggested", "orders"]);

		const closed = closeTab(opened.state, catalog, "orders", board);
		expect(visibleIds(closed.state, catalog)).toEqual(["suggested"]);
	});
});

describe("layouts", () => {
	test("pins keep the order they were made in", () => {
		const state = run([pin("clients"), pin("orders")]);
		expect(layoutOf(state).pinned).toEqual(["clients", "orders"]);
		expect(visibleIds(state, catalog)).toEqual([
			"suggested",
			"clients",
			"orders",
		]);
	});

	test("a pin the catalog cannot name waits for it instead of disappearing", () => {
		const state = restoreLayout(emptyTabSet, {
			pinned: ["sf-installed-later"],
			unpinned: [],
		});

		expect(visibleIds(state, catalog)).toEqual(["suggested"]);
		expect(
			visibleIds(state, [
				...catalog,
				{ id: "sf-installed-later", label: "Later" },
			]),
		).toContain("sf-installed-later");
	});

	test("restoring a layout that pins the transient tab keeps it, now pinned", () => {
		const state = run([open("orders")]);
		const restored = restoreLayout(state, { pinned: ["orders"], unpinned: [] });

		expect(restored.transient).toBeNull();
		expect(visibleIds(restored, catalog)).toEqual(["suggested", "orders"]);
	});

	test("resetting forgets what is open and keeps the pins", () => {
		const state = run([open("orders"), pin("orders"), open("clients")]);
		const reset = resetTabSet(state);

		expect(reset.active).toBeNull();
		expect(visibleIds(reset, catalog)).toEqual(["suggested", "orders"]);
	});

	test("local choices win over the stored layout, stored order first", () => {
		expect(
			mergeLayouts(
				{ pinned: ["a", "b"], unpinned: ["c"] },
				{ pinned: ["c", "d"], unpinned: ["b"] },
			),
		).toEqual({ pinned: ["a", "c", "d"], unpinned: ["b"] });
	});
});

describe("the catalog", () => {
	test("each entry says whether it is pinned, open and active", () => {
		const state = run([open("orders")]);
		const entries = catalogEntries(state, catalog);

		expect(entries.find((entry) => entry.id === "orders")).toMatchObject({
			open: true,
			active: true,
			pinned: false,
		});
		expect(entries.find((entry) => entry.id === "suggested")).toMatchObject({
			open: true,
			pinned: true,
		});
		expect(entries.find((entry) => entry.id === "create")?.kind).toBe(
			"command",
		);
	});

	test("search matches every word in label, description or group", () => {
		const item = { id: "x", label: "Создать заказ", group: "Команды" };
		expect(matchesQuery(item, "заказ созд")).toBe(true);
		expect(matchesQuery(item, "команды")).toBe(true);
		expect(matchesQuery(item, "клиент")).toBe(false);
		expect(matchesQuery(item, "  ")).toBe(true);
	});
});
