// wf-equipment-incident on the real VM core (librt-mock.so) with mocked
// equipment / orders / events / pushrouter. Build the library first:
//   cd ../../../core/native/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";
import { createIncidentUniverse } from "./mock-services";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

const HOUR = 3_600_000;
const at = (offset: number) => new Date(Date.now() + offset).toISOString();

/** A printer mid-job: one slot running now, one booked for tomorrow. */
function floor() {
	const u = createIncidentUniverse();
	u.addMachine("p1", { name: "Prusa #1" });
	u.addOrder("order-now");
	u.addOrder("order-tomorrow", "queued");
	u.addSlot({
		id: "slot-now",
		equipmentId: "p1",
		orderId: "order-now",
		status: "in_progress",
		startAt: at(-HOUR),
		endAt: at(HOUR),
	});
	u.addSlot({
		id: "slot-tomorrow",
		equipmentId: "p1",
		orderId: "order-tomorrow",
		startAt: at(24 * HOUR),
		endAt: at(26 * HOUR),
	});
	return u;
}

describe("wf-equipment-incident", () => {
	test("a broken machine releases its running slot and blocks the job on it", () => {
		const u = floor();

		const outcome = runWorkflow(
			source,
			{ equipmentId: "p1", description: "Nozzle clogged" },
			u.handler,
		);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(outcome.result.status).toBe("reported");
		expect(u.machines.get("p1").status).toBe("error");
		expect(u.logs).toEqual([
			expect.objectContaining({
				equipmentId: "p1",
				eventType: "incident",
				severity: "error",
				description: "Nozzle clogged",
			}),
		]);

		expect(u.slots.get("slot-now").status).toBe("cancelled");
		expect(u.orders.get("order-now").status).toBe("blocked");
		expect(outcome.result.blockedOrders).toEqual(["order-now"]);

		// Tomorrow is the shop's call, not the script's: counted, not touched.
		expect(u.slots.get("slot-tomorrow").status).toBe("planned");
		expect(u.orders.get("order-tomorrow").status).toBe("queued");
		expect(outcome.result.atRiskSlots).toEqual([
			expect.objectContaining({
				id: "slot-tomorrow",
				orderId: "order-tomorrow",
			}),
		]);

		expect(u.events).toEqual([
			expect.objectContaining({ type: "equipment.incident", entityId: "p1" }),
		]);
		expect(u.pushes).toEqual([
			expect.objectContaining({
				name: "equipment.incident",
				level: "error",
				title: "Prusa #1",
				body: "Nozzle clogged",
				link: { surface: "equipment", ref: "p1" },
				params: { blockedOrders: 1, atRisk: 1 },
			}),
		]);
	});

	test("a planned slot whose window has already opened counts as running", () => {
		const u = floor();
		u.slots.get("slot-now").status = "planned";

		const outcome = runWorkflow(source, { equipmentId: "p1" }, u.handler);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(u.slots.get("slot-now").status).toBe("cancelled");
		expect(u.orders.get("order-now").status).toBe("blocked");
		// Nobody typed a description: the journal still says which machine.
		expect(u.logs[0].description).toBe("Prusa #1 reported an error");
	});

	test("finished and already-blocked work is left alone", () => {
		const u = floor();
		u.orders.get("order-now").status = "completed";

		const outcome = runWorkflow(source, { equipmentId: "p1" }, u.handler);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(u.slots.get("slot-now").status).toBe("cancelled");
		expect(u.orders.get("order-now").status).toBe("completed");
		expect(outcome.result.blockedOrders).toEqual([]);
		expect(u.calls).not.toContain("orders.updateStatus");
	});

	test("a machine already in error is not set again, but the incident is still logged", () => {
		const u = floor();
		u.machines.get("p1").status = "error";

		const outcome = runWorkflow(source, { equipmentId: "p1" }, u.handler);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(u.calls).not.toContain("equipment.updateState");
		expect(u.logs).toHaveLength(1);
	});

	test("one failing step is a line in the report, not a floor left uninformed", () => {
		const u = floor();
		u.failOn("orders", "updateStatus", "orders is down");
		u.failOn("pushrouter", "publish", "fujin unreachable");

		const outcome = runWorkflow(source, { equipmentId: "p1" }, u.handler);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(u.slots.get("slot-now").status).toBe("cancelled");
		expect(u.events).toHaveLength(1);
		expect(outcome.result.errors.map((error: any) => error.stage)).toEqual([
			"order",
			"notify",
		]);
	});

	test("a dry run reports what it would do and changes nothing", () => {
		const u = floor();

		const outcome = runWorkflow(
			source,
			{ equipmentId: "p1", dryRun: true },
			u.handler,
		);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(outcome.result.status).toBe("dry-run");
		expect(outcome.result.cancelledSlots).toEqual(["slot-now"]);
		expect(outcome.result.affectedOrders).toEqual(["order-now"]);
		expect(u.machines.get("p1").status).toBe("running");
		expect(u.slots.get("slot-now").status).toBe("in_progress");
		expect(u.logs).toEqual([]);
		expect(u.pushes).toEqual([]);
	});

	test("an unknown machine fails the run instead of reporting nothing", () => {
		const u = floor();
		const outcome = runWorkflow(source, { equipmentId: "ghost" }, u.handler);
		expect(outcome.ok).toBe(false);
		if (outcome.ok) return;
		expect(outcome.error).toContain("machine not found");
	});
});
