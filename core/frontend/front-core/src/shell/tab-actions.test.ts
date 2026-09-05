import { beforeEach, describe, expect, test } from "bun:test";
import { objectRegistry, surfaceConfigured } from "front-core/object-runtime";
import {
	$workspaceTabViews,
	registerWorkspaceTabActions,
	workspaceTabActionInvoked,
} from "./tab-actions";
import {
	$surfaceTabs,
	subtabOpened,
	surfaceMounted,
	workspaceReset,
} from "./workspace";

const View = () => null;

objectRegistry.declare("sf-orders", {
	id: "sf-orders",
	label: "Orders",
	purpose: "Test surface orders",
	types: [],
	views: [],
	operations: [],
});
objectRegistry.declare("sf-companies", {
	id: "sf-companies",
	label: "Companies",
	purpose: "Test surface companies",
	types: [],
	views: [],
	operations: [],
});

function open(surface: string, key: string): void {
	subtabOpened({ key, surface, title: key, view: View, props: {} });
}

describe("workspace tab actions", () => {
	beforeEach(() => {
		workspaceReset();
		surfaceConfigured({
			surfaces: [
				{ id: "sf-orders", order: 1 },
				{ id: "sf-companies", order: 2 },
			],
		});
	});

	test("the strip gets a ready-made view of every mounted surface", () => {
		open("sf-orders", "orders.list");
		surfaceMounted("sf-companies");

		const views = $workspaceTabViews.getState();
		expect(views.map((tab) => tab.key)).toEqual(["sf-orders", "sf-companies"]);
		expect(views[1].active).toBe(true);
		expect(views[0].actions.map((action) => action.id)).toEqual([
			"pin",
			"close",
		]);
	});

	test("pin action toggles the surface and its menu label", () => {
		open("sf-orders", "orders.list");
		expect($workspaceTabViews.getState()[0].actions[0].label).toBe("Pin");

		workspaceTabActionInvoked({ key: "sf-orders", actionId: "pin" });

		const [tab] = $workspaceTabViews.getState();
		expect(tab.pinned).toBe(true);
		expect(tab.actions[0].label).toBe("Unpin");
	});

	test("closing a surface removes the tab and everything under it", () => {
		open("sf-orders", "orders.list");
		open("sf-companies", "companies.list");

		workspaceTabActionInvoked({ key: "sf-orders", actionId: "close" });

		expect($surfaceTabs.getState().map((tab) => tab.id)).toEqual([
			"sf-companies",
		]);
	});

	test("a surface can add its own action without touching the strip", () => {
		let refreshed: string | null = null;
		registerWorkspaceTabActions("sf-orders", (tab) => [
			{ id: "refresh", label: "Обновить", run: () => (refreshed = tab.id) },
		]);

		open("sf-orders", "orders.list");
		expect($workspaceTabViews.getState()[0].actions.map((a) => a.id)).toContain(
			"refresh",
		);

		workspaceTabActionInvoked({ key: "sf-orders", actionId: "refresh" });
		expect(refreshed).toBe("sf-orders");
	});
});
