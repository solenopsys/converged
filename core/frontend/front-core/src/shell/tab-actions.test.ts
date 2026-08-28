import { beforeEach, describe, expect, test } from "bun:test";
import {
	$workspaceTabViews,
	registerWorkspaceTabActions,
	workspaceTabActionInvoked,
} from "./tab-actions";
import { $workspaceTabs, workspaceReset, workspaceTabOpened } from "./workspace";

const View = () => null;

function open(key: string, pinned = false): void {
	workspaceTabOpened({
		key,
		owner: key.split(".", 1)[0] ?? key,
		title: key,
		view: View,
		props: {},
		...(pinned ? { pinned: true } : {}),
	});
}

describe("workspace tab actions", () => {
	beforeEach(() => workspaceReset());

	test("panel gets a ready-made view of every tab", () => {
		open("orders.list", true);
		open("orders.detail.42");

		const views = $workspaceTabViews.getState();
		expect(views.map((tab) => tab.key)).toEqual([
			"orders.list",
			"orders.detail.42",
		]);
		expect(views[0].pinned).toBe(true);
		expect(views[1].active).toBe(true);
		expect(views[0].actions.map((action) => action.id)).toEqual([
			"pin",
			"close",
			"close-transient",
		]);
	});

	test("pin action toggles the tab and its menu label", () => {
		open("orders.list");
		expect($workspaceTabViews.getState()[0].actions[0].label).toBe("Pin");

		workspaceTabActionInvoked({ key: "orders.list", actionId: "pin" });

		const [tab] = $workspaceTabViews.getState();
		expect(tab.pinned).toBe(true);
		expect(tab.actions[0].label).toBe("Unpin");
	});

	test("close-transient keeps pinned tabs only", () => {
		open("orders.list", true);
		open("orders.detail.42");

		workspaceTabActionInvoked({
			key: "orders.detail.42",
			actionId: "close-transient",
		});

		expect($workspaceTabs.getState().map((tab) => tab.key)).toEqual([
			"orders.list",
		]);
	});

	test("owner can add its own action without touching the panel", () => {
		let refreshed: string | null = null;
		registerWorkspaceTabActions("orders", (tab) => [
			{ id: "refresh", label: "Обновить", run: () => (refreshed = tab.key) },
		]);

		open("orders.list");
		expect($workspaceTabViews.getState()[0].actions.map((a) => a.id)).toContain(
			"refresh",
		);

		workspaceTabActionInvoked({ key: "orders.list", actionId: "refresh" });
		expect(refreshed).toBe("orders.list");
	});
});
