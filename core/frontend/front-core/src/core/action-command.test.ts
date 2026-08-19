import { describe, expect, test } from "bun:test";
import {
	actionCommand,
	actionCommandActivated,
	actionCommandFx,
	setActionCommandLoader,
} from "./action-command";
import { registry } from "./registry";

describe("actionCommand", () => {
	test("loads a declared owner before activating and invoking its action", async () => {
		const actionId = "test.command.load-before-activate";
		const order: string[] = [];
		registry.declare({ id: actionId, access: "public", description: "Test action" });
		setActionCommandLoader(async (id) => {
			order.push(`load:${id}`);
			registry.register({
				id,
				access: "public",
				description: "Test action",
				invoke: () => {
					order.push(`invoke:${id}`);
					return { ok: true };
				},
			});
		});
		const stop = actionCommandActivated.watch(({ actionId: id }) => {
			if (id === actionId) order.push(`activate:${id}`);
		});

		await expect(actionCommand({ actionId })).resolves.toEqual({ ok: true });
		stop();
		expect(order).toEqual([
			`load:${actionId}`,
			`activate:${actionId}`,
			`invoke:${actionId}`,
		]);
	});

	test("reports a loader failure through the command effect", async () => {
		const actionId = "test.command.loader-failure";
		const failures: string[] = [];
		registry.declare({ id: actionId, access: "public", description: "Test action" });
		setActionCommandLoader(async () => {
			throw new Error("module import failed");
		});
		const stop = actionCommandFx.fail.watch(({ error }) => {
			failures.push(error instanceof Error ? error.message : String(error));
		});

		await expect(actionCommand({ actionId })).rejects.toThrow("module import failed");
		stop();
		expect(failures).toEqual(["module import failed"]);
	});
});
