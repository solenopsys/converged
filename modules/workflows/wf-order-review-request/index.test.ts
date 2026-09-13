// wf-order-review-request on the real VM core (librt-mock.so) with mocked
// rp-orders / rp-reviews / lm-ses. Build the library first:
//   cd ../../../core/native/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";
import { createReviewUniverse } from "./mock-services";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

const PARAMS = {
	from: "shop@example.com",
	ses: { accessKeyId: "k", secretAccessKey: "s", region: "eu-central-1" },
	shopName: "Acme Works",
};

describe("wf-order-review-request", () => {
	test("mints a personal link for a finished order and asks once", () => {
		const u = createReviewUniverse();
		u.addOrder({});

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("sent");
		expect(outcome.result.orderId).toBe("order-1");
		expect(outcome.result.messageId).toBe("msg-1");

		expect(u.mails).toHaveLength(1);
		expect(u.mails[0]).toMatchObject({
			from: "shop@example.com",
			to: "ann@example.com",
			type: "text",
		});
		expect(u.mails[0].subject).toBe("How did we do with Bracket?");
		// The link carries the token, so the review always knows its order.
		expect(u.mails[0].body).toContain("https://shop.test/review/token-1");
		expect(u.mails[0].body).toContain("Hello Ann");

		expect(u.invites).toHaveLength(1);
		expect(u.invites[0]).toMatchObject({
			orderId: "order-1",
			contact: "ann@example.com",
			lang: "en",
			status: "sent",
		});
		expect(u.invites[0].sentAt).toBeDefined();
	});

	test("asks one customer per run, not the whole backlog", () => {
		const u = createReviewUniverse();
		u.addOrder({});
		u.addOrder({ customerEmail: "bob@example.com" });

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		expect(u.mails).toHaveLength(1);
		expect(u.invites).toHaveLength(1);
	});

	test("never asks twice about the same order", () => {
		const u = createReviewUniverse();
		u.addOrder({});
		u.addInvite({ orderId: "order-1", status: "sent" });

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("all-asked");
		expect(u.mails).toEqual([]);
	});

	test("leaves an order with nobody to write to alone", () => {
		const u = createReviewUniverse();
		u.addOrder({ customerEmail: undefined });

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("no-candidate");
		expect(u.mails).toEqual([]);
	});

	test("waits out the delay before asking about a fresh order", () => {
		const u = createReviewUniverse();
		u.addOrder({ updatedAt: new Date().toISOString() });

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("no-candidate");
		expect(u.invites).toEqual([]);
	});

	test("a dry run renders the mail and mints nothing", () => {
		const u = createReviewUniverse();
		u.addOrder({});

		const outcome = runWorkflow(source, { ...PARAMS, dryRun: true }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("ready");
		expect(outcome.result.body).toContain("<token>");
		// A rehearsal that left a live link behind would make the next real run
		// skip this order as already asked.
		expect(u.invites).toEqual([]);
		expect(u.mails).toEqual([]);
	});

	test("a refused mail marks the link failed instead of throwing", () => {
		const u = createReviewUniverse();
		u.addOrder({});
		u.sendError = "mailbox full";

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("send-failed");
		expect(outcome.result.error).toBe("mailbox full");
		expect(u.invites[0]).toMatchObject({
			status: "failed",
			error: "mailbox full",
		});
	});
});
