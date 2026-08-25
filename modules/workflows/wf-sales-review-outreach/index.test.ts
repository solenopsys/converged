// wf-sales-review-outreach on the real VM core (librt-mock.so) with mocked
// ms-sales / ms-smtp. Build the library first:
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
	lang: "en",
	from: "sales@4ir.club",
	smtp: { host: "smtp.test", port: 587, secure: false },
	reviewUrl: "https://4ir.club/r/lead-1",
	googleMapsReviewUrl: "https://maps.test/review",
};

function seed() {
	const u = createReviewUniverse();
	u.setCandidate("en", {}, {});
	return u;
}

describe("wf-sales-review-outreach", () => {
	test("sends the review request and records event + touch", () => {
		const u = seed();

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		const r = outcome.result;
		expect(r.status).toBe("sent");
		expect(r.leadId).toBe("lead-1");
		expect(r.recipientEmail).toBe("owner@acme.test");
		expect(r.messageId).toBe("msg-1");

		expect(u.mails.length).toBe(1);
		expect(u.mails[0]).toMatchObject({
			from: "sales@4ir.club",
			to: "owner@acme.test",
			type: "text",
		});
		expect(u.mails[0].body).toContain("https://4ir.club/r/lead-1");
		expect(u.mails[0].body).toContain("https://maps.test/review");

		expect(u.events[0]).toMatchObject({
			type: "email_sent",
			leadId: "lead-1",
			contactId: "contact-1",
			code: r.trackingCode,
			url: "https://4ir.club/r/lead-1",
		});
		expect(u.touches[0]).toMatchObject({ contactId: "contact-1" });
		expect(String(u.touches[0].description)).toBe(
			"Review outreach email sent to owner@acme.test; messageId=msg-1",
		);
	});

	test("no candidate: nothing is sent", () => {
		const u = createReviewUniverse();
		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("no-candidate");
		expect(u.mails).toEqual([]);
	});

	test("a candidate whose contact is not an email is left alone", () => {
		const u = createReviewUniverse();
		u.setCandidate("en", {}, { type: "PHONE", value: "+1 555 0100" });

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("candidate-has-no-email");
		expect(u.mails).toEqual([]);
		expect(u.touches).toEqual([]);
	});

	test("dryRun renders the mail but sends nothing", () => {
		const u = seed();
		const outcome = runWorkflow(source, { ...PARAMS, dryRun: true }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("ready");
		expect(outcome.result.body).toContain("https://4ir.club/r/lead-1");
		expect(u.mails).toEqual([]);
		expect(u.events).toEqual([]);
		expect(u.touches).toEqual([]);
	});

	test("a refused mail is a branch, not a failed run — no event, no touch", () => {
		const u = seed();
		u.sendError = "mailbox unavailable";

		const outcome = runWorkflow(source, PARAMS, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.status).toBe("send-failed");
		expect(outcome.result.error).toBe("mailbox unavailable");
		expect(u.events).toEqual([]);
		expect(u.touches).toEqual([]);
	});

	test("custom templates win over the defaults", () => {
		const u = seed();
		const outcome = runWorkflow(
			source,
			{
				...PARAMS,
				subjectTemplate: "{{leadDescription}} — how did we do?",
				bodyTemplate: "Hi {{recipientEmail}}, review us: {{reviewUrl}}",
				touchDescriptionTemplate: "review ask {{trackingCode}}",
			},
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.subject).toBe("Acme order #42 — how did we do?");
		expect(u.mails[0].body).toBe(
			"Hi owner@acme.test, review us: https://4ir.club/r/lead-1",
		);
		expect(String(u.touches[0].description)).toBe(
			`review ask ${outcome.result.trackingCode}`,
		);
	});

	test("missing credentials fail the run loudly", () => {
		const u = seed();
		const outcome = runWorkflow(source, { ...PARAMS, from: "" }, u.handler);
		expect(outcome.ok).toBe(false);
		if (outcome.ok) return;
		expect(outcome.error).toContain("params.from");
	});
});
