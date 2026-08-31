import { beforeEach, describe, expect, test } from "bun:test";
import {
	$activeWorkspaceTab,
	$workspaceTabs,
	workspaceReset,
	workspaceTabActivated,
	workspaceTabOpened,
	workspaceTabPinToggled,
} from "./workspace";

const View = () => null;

function open(
	key: string,
	pinned = false,
	source: "assistant" | "user" = "user",
): void {
	workspaceTabOpened({
		key,
		owner: key.split(".", 1)[0] ?? key,
		title: key,
		view: View,
		props: {},
		...(pinned ? { pinned: true } : {}),
		source,
	});
}

describe("workspace", () => {
	beforeEach(() => workspaceReset());

	test("keeps pinned tabs and replaces transient tabs for an assistant presentation", () => {
		open("orders.list", true);
		open("orders.detail.42");
		open("companies.list", false, "assistant");

		expect($workspaceTabs.getState().map((tab) => tab.key)).toEqual([
			"orders.list",
			"companies.list",
		]);
		expect($activeWorkspaceTab.getState()?.key).toBe("companies.list");
	});

	test("reopens an existing tab without losing its pin", () => {
		open("orders.list");
		workspaceTabPinToggled("orders.list");
		open("orders.list");

		expect($workspaceTabs.getState()).toHaveLength(1);
		expect($workspaceTabs.getState()[0]?.pinned).toBe(true);
	});

	test("activates an existing tab without changing its order", () => {
		open("orders.list");
		open("orders.detail.42");
		workspaceTabActivated("orders.list");

		expect($activeWorkspaceTab.getState()?.key).toBe("orders.list");
		expect($workspaceTabs.getState().map((tab) => tab.key)).toEqual([
			"orders.list",
			"orders.detail.42",
		]);
	});
});
