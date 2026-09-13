// wf-order-review-followup on the real VM core (librt-mock.so) with mocked
// rp-orders / rp-reviews / lm-ses. Shares the universe of its sibling flow:
//   cd ../../../core/native/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";
import { createReviewUniverse } from "../wf-order-review-request/mock-services";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

const PARAMS = {
	from: "shop@example.com",
	ses: { accessKeyId: "k", secretAccessKey: "s", region: "eu-central-1" },
	shopName: "Acme Works",
};

function seed() {
	const u = createReviewUniverse();
	u.addOrder({});
	const invite = u.addInvite({
		orderId: "order-1",
		status: "sent",
		sentAt: "2026-07-02T00:00:00.000Z",
	});
	u.followupQueue = [invite];
	return u;
}

describe("wf-order-review-followup", () => {
	test("chases a quiet link once and counts the chase", () => {
		const u = seed();

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("sent");
		expect(outcome.result.followupCount).toBe(1);

		expect(u.mails).toHaveLength(1);
		expect(u.mails[0].subject).toBe("A minute for Bracket?");
		// The same link, not a new one: the customer's original mail still works.
		expect(u.mails[0].body).toContain("https://shop.test/review/token-1");

		// Counting it is what makes this the *single* chase.
		expect(u.invites[0]).toMatchObject({ followupCount: 1, status: "sent" });
		expect(u.invites[0].lastFollowupAt).toBeDefined();
	});

	test("does nothing when no link is due", () => {
		const u = createReviewUniverse();

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("nothing-due");
		expect(u.mails).toEqual([]);
	});

	test("stays silent when the shop has switched chasing off", () => {
		const u = seed();
		u.settings = { ...u.settings, maxFollowups: 0 };

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("disabled");
		expect(u.calls).not.toContain("reviews.findInvitesToFollowUp");
		expect(u.mails).toEqual([]);
	});

	test("still writes when the order behind the link is gone", () => {
		const u = seed();
		u.orders = [];

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("sent");
		expect(u.mails[0].subject).toBe("A minute for order-1?");
	});

	test("a refused chase leaves the link sent, not failed", () => {
		const u = seed();
		u.sendError = "mailbox full";

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("send-failed");
		// The first mail did go out; the customer may still answer it.
		expect(u.invites[0]).toMatchObject({ status: "sent", followupCount: 0 });
	});

	test("a dry run renders the chase and counts nothing", () => {
		const u = seed();

		const outcome = runWorkflow(source, { ...PARAMS, dryRun: true }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("ready");
		expect(u.mails).toEqual([]);
		expect(u.invites[0].followupCount).toBe(0);
	});
});
