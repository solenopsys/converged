// wf-request-to-order on the real VM core (librt-mock.so) with mocked requests /
// orders / events. Build the library first:
//   cd ../../../core/native/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";
import { createConversionUniverse } from "./mock-services";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

describe("wf-request-to-order", () => {
	test("turns a request into a queued job carrying its requestId", () => {
		const u = createConversionUniverse();
		u.addRequest("req-1", {
			title: "Bracket v2",
			processType: "3d_printing",
			fields: {
				quantity: { value: 12 },
				material_choice: { value: "PETG" },
			},
		});

		const outcome = runWorkflow(source, { requestId: "req-1" }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("created");
		const order = u.orders.get(outcome.result.orderId);
		// The whole point of the workflow: this link exists, and nothing but a
		// workflow could have written it.
		expect(order.requestId).toBe("req-1");
		expect(order.modelName).toBe("Bracket v2");
		expect(order.productionMethod).toBe("fdm");
		expect(order.status).toBe("queued");
		expect(order.quantity).toBe(12);
		expect(order.material).toBe("PETG");

		// The request follows the work, and the journal records the step.
		expect(u.models.get("req-1").status).toBe("in_production");
		expect(u.events).toHaveLength(1);
		expect(u.events[0].type).toBe("order.created");
		expect(u.events[0].entityId).toBe(outcome.result.orderId);
		expect(u.events[0].parentId).toBe("req-1");
	});

	test("reads free-form field keys and the values people type into them", () => {
		const u = createConversionUniverse();
		u.addRequest("req-2", {
			processType: "cnc_machining",
			files: { "flange.step": "file-1" },
			fields: {
				"Количество деталей": { value: "8 шт" },
				Материал: { value: "AL6082" },
				deadline_date: { value: "2026-10-01" },
				contact_email: { value: "client@shop.test" },
			},
		});

		const outcome = runWorkflow(source, { requestId: "req-2" }, u.handler);
		if (!outcome.ok) throw new Error(outcome.error);

		const order = u.orders.get(outcome.result.orderId);
		expect(order.quantity).toBe(8);
		expect(order.material).toBe("AL6082");
		expect(order.dueAt).toBe("2026-10-01");
		expect(order.customerEmail).toBe("client@shop.test");
		expect(order.productionMethod).toBe("cnc");
		// No title on the request: the file is a better label than the id.
		expect(order.modelName).toBe("flange.step");
	});

	test("parameters win over what the form said", () => {
		const u = createConversionUniverse();
		u.addRequest("req-3", {
			processType: "3d_printing",
			fields: { quantity: { value: 1 } },
		});

		const outcome = runWorkflow(
			source,
			{
				requestId: "req-3",
				productionMethod: "sls",
				quantity: 40,
				material: "PA12",
				equipmentId: "eq-7",
			},
			u.handler,
		);
		if (!outcome.ok) throw new Error(outcome.error);

		const order = u.orders.get(outcome.result.orderId);
		expect(order.productionMethod).toBe("sls");
		expect(order.quantity).toBe(40);
		expect(order.material).toBe("PA12");
		expect(order.equipmentId).toBe("eq-7");
	});

	test("a second run answers with the job that exists", () => {
		const u = createConversionUniverse();
		u.addRequest("req-4", { title: "Cover" });
		const first = u.addOrder("req-4", "Cover");

		const outcome = runWorkflow(source, { requestId: "req-4" }, u.handler);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(outcome.result.status).toBe("exists");
		expect(outcome.result.orderId).toBe(first);
		// One request, one job — and no second journal line about it either.
		expect(u.orders.size).toBe(1);
		expect(u.events).toHaveLength(0);
		expect(u.calls).not.toContain("orders.createOrder");
	});

	test("a request that cannot be moved still leaves the job queued", () => {
		const u = createConversionUniverse();
		u.addRequest("req-5", { title: "Spacer" });
		u.failOn("requests", "updateStatus", "request store unavailable");

		const outcome = runWorkflow(source, { requestId: "req-5" }, u.handler);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(outcome.result.status).toBe("created");
		expect(u.orders.size).toBe(1);
		// The failure is reported, not thrown: the shop has the work, and the
		// wrong label on the request is repaired by re-running.
		expect(outcome.result.errors[0].stage).toBe("request-status");
		expect(u.models.get("req-5").status).toBe("ready");
	});

	test("refuses a request that does not exist", () => {
		const u = createConversionUniverse();
		const outcome = runWorkflow(source, { requestId: "nope" }, u.handler);
		expect(outcome.ok).toBe(false);
		expect(u.orders.size).toBe(0);
	});
});
