import { beforeEach, describe, expect, test } from "bun:test";
import { createStore } from "effector";
import { actionCommandActivated } from "front-core/core";
import { registerScreens } from "./screens";
import { $workspaceTabs, workspaceReset, workspaceTabClosed } from "./workspace";

const View = () => null;
const $screen = createStore("list");
const screenId = "screen-test.list";

describe("screen registration", () => {
	beforeEach(() => workspaceReset());

	test("reopens a closed tab when the same module command is activated again", () => {
		registerScreens([
			{
				id: screenId,
				when: $screen,
				is: "list",
				view: View,
				title: "Test list",
			},
		]);
		workspaceTabClosed(screenId);

		actionCommandActivated({ actionId: "screen-test.show", source: "user" });

		expect($workspaceTabs.getState().map((tab) => tab.key)).toContain(screenId);
		expect($workspaceTabs.getState()[0]?.mountActionId).toBe(
			"screen-test.show",
		);
	});
});
