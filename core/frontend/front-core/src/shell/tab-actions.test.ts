import { beforeEach, describe, expect, test } from "bun:test";
import { objectRegistry, surfaceConfigured } from "front-core/object-runtime";
import { registerWorkspaceTabActions } from "./tab-actions";
import {
	$surfaceTabs,
	menus,
	surfaceMounted,
	surfacePinToggled,
	surfaces,
	workspaceReset,
} from "./workspace";
import { surfaceStrip } from "./workspace-bars";

for (const [id, label] of [
	["sf-ta-orders", "Orders"],
	["sf-ta-companies", "Companies"],
]) {
	objectRegistry.declare(id, {
		id,
		label,
		purpose: `Test surface ${label}`,
		types: [],
		views: [],
		operations: [
			{ id: `${id}.probe`, operator: "execute", label, access: "public" },
		],
	});
}

describe("workspace tab actions", () => {
	beforeEach(() => {
		workspaceReset();
		surfaces.cleared();
		menus.cleared();
		surfaceConfigured({
			surfaces: [
				{ id: "sf-ta-orders", order: 1 },
				{ id: "sf-ta-companies", order: 2 },
			],
		});
	});

	test("every tab in the strip gets pin and close", () => {
		surfaceMounted("sf-ta-orders");

		expect(
			surfaceStrip.$actions
				.getState()
				["sf-ta-orders"]?.map((action) => action.id),
		).toEqual(["pin", "close"]);
	});

	test("the pin action toggles the surface and its label", () => {
		surfaceMounted("sf-ta-orders");
		expect(surfaceStrip.$actions.getState()["sf-ta-orders"]?.[0]?.label).toBe(
			"Pin",
		);

		surfaceStrip.context.openedAt({ id: "sf-ta-orders", x: 0, y: 0 });
		surfaceStrip.context.chosen("pin");

		expect($surfaceTabs.getState()[0]?.pinned).toBe(true);
		expect(surfaceStrip.$actions.getState()["sf-ta-orders"]?.[0]?.label).toBe(
			"Unpin",
		);
	});

	test("closing a surface removes its tab", () => {
		surfacePinToggled("sf-ta-orders");
		surfaceMounted("sf-ta-companies");

		surfaceStrip.context.openedAt({ id: "sf-ta-orders", x: 0, y: 0 });
		surfaceStrip.context.chosen("close");

		expect($surfaceTabs.getState().map((tab) => tab.id)).toEqual([
			"sf-ta-companies",
		]);
	});

	test("a surface can add its own action without touching the strip", () => {
		let refreshed: string | null = null;
		registerWorkspaceTabActions("sf-ta-orders", (tab) => [
			{ id: "refresh", label: "Обновить", run: () => (refreshed = tab.id) },
		]);

		surfaceMounted("sf-ta-orders");
		expect(
			surfaceStrip.$actions
				.getState()
				["sf-ta-orders"]?.map((action) => action.id),
		).toContain("refresh");

		surfaceStrip.context.openedAt({ id: "sf-ta-orders", x: 0, y: 0 });
		surfaceStrip.context.chosen("refresh");
		expect(refreshed).toBe("sf-ta-orders");
	});
});
