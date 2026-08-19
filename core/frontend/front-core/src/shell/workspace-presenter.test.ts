import { beforeEach, describe, expect, test } from "bun:test";
import { actionCommand, registry } from "front-core/core";
import "./workspace-presenter";
import { $activeWorkspaceTab, workspaceReset } from "./workspace";

const View = () => null;

describe("workspace presenter", () => {
	beforeEach(() => workspaceReset());

	test("mounts a presented widget in the central workspace through its action", async () => {
		const actionId = "presenter-test.open";
		registry.register({
			id: actionId,
			brief: "Open test workspace",
			category: "presenter-test",
			description: "Open the workspace used by the presenter integration test.",
			invoke: (params) => {
				registry.present({
					widget: {
						view: View,
						placement: () => "sidebar:right",
						config: { fromConfig: true },
						commands: { refresh: () => undefined },
					},
					params,
				});
			},
		});

		await actionCommand({ actionId, params: { recordId: "42" } });

		expect($activeWorkspaceTab.getState()).toMatchObject({
			key: actionId,
			owner: "presenter-test",
			title: "Open test workspace",
			view: View,
			props: { fromConfig: true, recordId: "42" },
		});
	});
});
