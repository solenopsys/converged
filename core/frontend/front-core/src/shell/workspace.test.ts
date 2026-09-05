import { beforeEach, describe, expect, test } from "bun:test";
import {
	objectOf,
	objectRegistry,
	registerSurface,
	setOf,
	surfaceConfigured,
} from "front-core/object-runtime";
import {
	$activeSubtabs,
	$activeSurface,
	$pressedSubtab,
	$surfaceTabs,
	subtabActivated,
	subtabClosed,
	subtabOpened,
	subtabReleased,
	surfaceActivated,
	surfaceMounted,
	surfacePinToggled,
	workspaceReset,
} from "./workspace";

const View = () => null;
let projectionPrepared = 0;

function declare(
	id: string,
	label: string,
	access: "public" | "user" = "public",
): void {
	objectRegistry.declare(id, {
		id,
		label,
		purpose: `Test surface ${label}`,
		types: [],
		views: [],
		// A surface is offered only when the session can reach something in it,
		// so a fixture needs one discoverable operation to exist at all.
		operations: [
			{
				id: `${id}.probe`,
				operator: "execute",
				label: `${label} probe`,
				access,
			},
		],
	});
}

declare("sf-orders", "Orders");
declare("sf-companies", "Companies");
declare("sf-projections", "Projections");
registerSurface({
	id: "sf-projections",
	label: "Projections",
	purpose: "A surface with declared views",
	types: [
		{
			id: "projection.item",
			label: "Projection item",
			pluralLabel: "Projection items",
		},
	],
	views: [
		{
			id: "projection.item.table",
			accepts: setOf("projection.item"),
			component: View,
			props: () => {
				projectionPrepared += 1;
				return {};
			},
		},
		{
			id: "projection.item.detail",
			accepts: objectOf("projection.item"),
			component: View,
		},
	],
	operations: [],
});

function open(surface: string, key: string, permanent = false): void {
	subtabOpened({
		key,
		surface,
		title: key,
		view: View,
		props: {},
		...(permanent ? { permanent: true } : {}),
	});
}

describe("workspace", () => {
	beforeEach(() => {
		workspaceReset();
		projectionPrepared = 0;
		surfaceConfigured({
			surfaces: [
				{ id: "sf-orders", order: 1 },
				{ id: "sf-companies", order: 2 },
			],
		});
	});

	test("opening something presses a button inside its own surface", () => {
		open("sf-orders", "orders.list");
		open("sf-orders", "orders.detail.42");

		// One tab, two buttons — not two tabs.
		expect($surfaceTabs.getState().map((tab) => tab.id)).toEqual(["sf-orders"]);
		expect($activeSubtabs.getState().map((subtab) => subtab.key)).toEqual([
			"orders.list",
			"orders.detail.42",
		]);
		expect($pressedSubtab.getState()?.key).toBe("orders.detail.42");
	});

	test("a second surface is a second tab, and each keeps its own pressed button", () => {
		open("sf-orders", "orders.list");
		open("sf-companies", "companies.list");
		surfaceActivated("sf-orders");

		expect($activeSurface.getState()).toBe("sf-orders");
		expect($pressedSubtab.getState()?.key).toBe("orders.list");

		surfaceActivated("sf-companies");
		expect($pressedSubtab.getState()?.key).toBe("companies.list");
	});

	test("a mounted surface with nothing pressed shows its own screen", () => {
		surfaceMounted("sf-orders");

		expect($activeSurface.getState()).toBe("sf-orders");
		expect($pressedSubtab.getState()).toBeNull();
		expect($surfaceTabs.getState()[0]?.pressed).toBeNull();
	});

	test("mounting registers unpressed permanent set projections", () => {
		surfaceMounted("sf-projections");

		const projections = $activeSubtabs.getState();
		expect(projections).toMatchObject([
			{
				key: "projection:projection.item.table",
				title: "Projection items",
				permanent: true,
				ref: {
					kind: "set",
					type: "projection.item",
					selection: { kind: "query" },
				},
			},
		]);
		expect($pressedSubtab.getState()).toBeNull();
	});

	test("a permanent projection cannot be closed", () => {
		surfaceMounted("sf-projections");
		subtabClosed("projection:projection.item.table");

		expect($activeSubtabs.getState()).toHaveLength(1);
	});

	test("a projection prepares its data only when it is pressed", () => {
		surfaceMounted("sf-projections");
		expect(projectionPrepared).toBe(0);

		subtabActivated("projection:projection.item.table");
		expect(projectionPrepared).toBe(1);
	});

	test("releasing a button returns to the surface, keeping the tab", () => {
		open("sf-orders", "orders.list");
		subtabReleased("sf-orders");

		expect($activeSurface.getState()).toBe("sf-orders");
		expect($pressedSubtab.getState()).toBeNull();
		expect($activeSubtabs.getState()).toHaveLength(1);
	});

	test("closing the pressed button releases the bar instead of pressing a neighbour", () => {
		open("sf-orders", "orders.list");
		open("sf-orders", "orders.detail.42");
		subtabClosed("orders.detail.42");

		expect($pressedSubtab.getState()).toBeNull();
		expect($activeSubtabs.getState().map((subtab) => subtab.key)).toEqual([
			"orders.list",
		]);
	});

	test("reopening the same thing reuses its button", () => {
		open("sf-orders", "orders.list");
		open("sf-orders", "orders.list");

		expect($activeSubtabs.getState()).toHaveLength(1);
	});

	test("pinning keeps a surface in the strip with nothing open in it", () => {
		surfacePinToggled("sf-companies");

		const tabs = $surfaceTabs.getState();
		expect(tabs.map((tab) => tab.id)).toEqual(["sf-companies"]);
		expect(tabs[0]?.pinned).toBe(true);
	});

	test("dynamic buttons are capped, permanent ones are not", () => {
		open("sf-orders", "orders.view", true);
		for (let index = 0; index < 12; index += 1) {
			open("sf-orders", `orders.detail.${index}`);
		}

		const keys = $activeSubtabs.getState().map((subtab) => subtab.key);
		expect(keys).toContain("orders.view");
		expect(keys.filter((key) => key !== "orders.view")).toHaveLength(8);
		expect(keys).not.toContain("orders.detail.0");
		expect(keys).toContain("orders.detail.11");
	});

	test("a surface the configuration does not list is not offered", () => {
		surfaceConfigured({ surfaces: [{ id: "sf-orders" }] });
		// Pinning is the offer: an unlisted surface cannot be put in the strip
		// this way. Opening one still can, and that is tested separately —
		// being offered and being open are different questions.
		surfacePinToggled("sf-companies");

		expect($surfaceTabs.getState().map((tab) => tab.id)).toEqual([]);
	});

	test("activating a button switches to its surface", () => {
		open("sf-orders", "orders.list");
		open("sf-companies", "companies.list");
		subtabActivated("orders.list");

		expect($activeSurface.getState()).toBe("sf-orders");
	});
});

describe("the strip follows the registry", () => {
	test("a surface declared after start-up appears without anything re-mounting", () => {
		workspaceReset();
		surfaceConfigured({
			surfaces: [
				{ id: "sf-orders", order: 1 },
				{ id: "sf-late", order: 2 },
			],
		});
		surfacePinToggled("sf-orders");
		expect($surfaceTabs.getState().map((tab) => tab.id)).toEqual(["sf-orders"]);

		declare("sf-late", "Late");
		surfacePinToggled("sf-late");

		// Without a revision the combine would be stale here and the tab strip
		// would keep showing the answer it computed before the surface existed.
		expect($surfaceTabs.getState().map((tab) => tab.id)).toEqual([
			"sf-orders",
			"sf-late",
		]);
	});
});

describe("authorization decides what is offered", () => {
	test("a surface needing an account is still offered to a guest", () => {
		workspaceReset();
		declare("sf-private", "Private", "user");
		surfaceConfigured({
			surfaces: [{ id: "sf-orders" }, { id: "sf-private" }],
		});
		surfacePinToggled("sf-orders");
		surfacePinToggled("sf-private");

		// Authorization here is a step in the flow, not a filter on it. The guest
		// is shown the section and signs in when they try to open it; hiding it
		// instead leaves them with nothing to click and no way to reach the
		// prompt — the turn just ends in words.
		expect($surfaceTabs.getState().map((tab) => tab.id)).toEqual([
			"sf-orders",
			"sf-private",
		]);
	});

	test("a surface already open stays in the strip even when it stops being offered", () => {
		workspaceReset();
		surfaceConfigured({ surfaces: [{ id: "sf-orders" }] });
		open("sf-unlisted", "unlisted.view");

		// It is on screen: dropping its tab would leave the user looking at a
		// screen they cannot navigate away from.
		expect($surfaceTabs.getState().map((tab) => tab.id)).toContain(
			"sf-unlisted",
		);
	});
});
