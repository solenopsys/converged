// wf-payment-settle on the real VM core (librt-mock.so) with mocked
// lm-lemonsqueezy / rp-invoices. Build the library first:
//   cd ../../../core/native/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";
import { createPaymentUniverse, orderPaid } from "./mock-services";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

const invoice = () => ({ id: "inv_1", number: 41, owner: "acme", total: 99 });

/** What the gateway publishes: the delivery wrapped in its envelope. */
const delivery = (body: unknown) => ({
	body: {
		endpoint: "lemonsqueezy",
		provider: "lemonsqueezy",
		headers: {},
		body,
	},
});

describe("wf-payment-settle", () => {
	test("a paid order settles its invoice", () => {
		const u = createPaymentUniverse([invoice()]);

		const outcome = runWorkflow(
			source,
			delivery(orderPaid("inv_1", "ord_9", 9900)),
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result).toMatchObject({
			status: "settled",
			invoiceId: "inv_1",
			number: 41,
			owner: "acme",
			providerRef: "ord_9",
		});
		expect(u.settled).toEqual([
			{ invoiceId: "inv_1", providerRef: "ord_9", provider: "lemonsqueezy" },
		]);
	});

	// The one that matters. Every provider retries, and a retry looks exactly
	// like a second payment to everything except the provider's reference.
	test("the same delivery twice pays once", () => {
		const u = createPaymentUniverse([invoice()]);
		const event = delivery(orderPaid("inv_1", "ord_9", 9900));

		expect(runWorkflow(source, event, u.handler).ok).toBe(true);
		const second = runWorkflow(source, event, u.handler);

		expect(second.ok).toBe(true);
		if (!second.ok) return;
		expect(second.result.status).toBe("already-settled");
		expect(u.settled).toHaveLength(1);
	});

	test("accepts a bare payload as well as a gateway envelope", () => {
		const u = createPaymentUniverse([invoice()]);

		const outcome = runWorkflow(
			source,
			{ body: orderPaid("inv_1", "ord_9", 9900) },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.status).toBe("settled");
	});

	// An order exists before it is paid. Settling on "pending" marks an invoice
	// paid that nobody has paid.
	test("a pending order settles nothing", () => {
		const u = createPaymentUniverse([invoice()]);
		const pending = orderPaid("inv_1", "ord_9", 9900);
		pending.data.attributes.status = "pending";

		const outcome = runWorkflow(source, delivery(pending), u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.status).toBe("ignored");
		expect(u.settled).toHaveLength(0);
	});

	// A refund is its own act with its own record. Undoing the payment here
	// would lose the fact that money once arrived.
	test("a refund is logged and settles nothing", () => {
		const u = createPaymentUniverse([invoice()]);

		const outcome = runWorkflow(
			source,
			delivery({
				meta: {
					event_name: "order_refunded",
					custom_data: { invoice_id: "inv_1" },
				},
				data: { id: "ord_9", attributes: { total: 9900 } },
			}),
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result).toMatchObject({
			status: "ignored",
			kind: "refunded",
		});
	});

	test("money with no invoice id is reported, not guessed at", () => {
		const u = createPaymentUniverse([invoice()]);
		const orphan = orderPaid("inv_1", "ord_9", 9900);
		(orphan.meta as any).custom_data = {};

		const outcome = runWorkflow(source, delivery(orphan), u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.status).toBe("unmatched");
		expect(u.settled).toHaveLength(0);
	});

	test("a payment for an invoice that does not exist is reported", () => {
		const u = createPaymentUniverse([invoice()]);

		const outcome = runWorkflow(
			source,
			delivery(orderPaid("inv_ghost", "ord_9", 9900)),
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result).toMatchObject({
			status: "unmatched",
			invoiceId: "inv_ghost",
		});
	});

	// Worth saying out loud, not worth refusing over: the money is in.
	test("settles even when the amount does not match the invoice", () => {
		const u = createPaymentUniverse([invoice()]);

		const outcome = runWorkflow(
			source,
			delivery(orderPaid("inv_1", "ord_9", 5000)),
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.status).toBe("settled");
	});

	test("dryRun changes nothing", () => {
		const u = createPaymentUniverse([invoice()]);

		const outcome = runWorkflow(
			source,
			{ ...delivery(orderPaid("inv_1", "ord_9", 9900)), dryRun: true },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.status).toBe("dry-run");
		expect(u.settled).toHaveLength(0);
	});
});
