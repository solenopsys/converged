// Mock rp-sales / rp-notify / lm-ses / lm-smtp universe for the wf-sales-review-outreach tests
// (test-only, never bundled into a workflow). One CallHandler for the
// centimanus mock harness; state is plain in-memory arrays, so a test can
// assert on the rows the workflow wrote (mails, events, touches).

import { createNotifyMock } from "../../../core/dag/mail/mock-notify";

export type MockCandidate = {
	lead: Record<string, unknown>;
	contact: Record<string, unknown>;
};

export type MockSentMail = {
	from?: string;
	to: string;
	subject: string;
	body?: string;
	text?: string;
	type?: string;
};

export type ReviewUniverse = {
	/** lang -> the candidate rp-sales hands out for it */
	candidates: Map<string, MockCandidate>;
	mails: MockSentMail[];
	events: Record<string, unknown>[];
	touches: Record<string, unknown>[];
	calls: string[];
	notify: ReturnType<typeof createNotifyMock>;
	transports: string[];
	/** when set, sendEmail answers { success: false, error } */
	sendError: string | null;

	setCandidate(
		lang: string,
		lead: Partial<MockCandidate["lead"]>,
		contact: Partial<MockCandidate["contact"]>,
	): void;
	failOn(service: string, method: string, message: string): void;
	handler(service: string, method: string, params: any): unknown;
};

const NOW = "2026-08-01T00:00:00.000Z";

export function createReviewUniverse(): ReviewUniverse {
	const failures = new Map<string, string>();
	let messageSeq = 0;

	const u: ReviewUniverse = {
		candidates: new Map(),
		mails: [],
		events: [],
		touches: [],
		calls: [],
		notify: createNotifyMock(),
		transports: [],
		sendError: null,

		setCandidate(lang, lead, contact) {
			u.candidates.set(lang, {
				lead: {
					id: "lead-1",
					description: "Acme order #42",
					lang,
					type: "reviews",
					catalogId: "",
					createdAt: NOW,
					...lead,
				},
				contact: {
					id: "contact-1",
					leadId: "lead-1",
					type: "EMAIL",
					value: "owner@acme.test",
					role: "owner",
					description: "",
					createdAt: NOW,
					...contact,
				},
			});
		},

		failOn(service, method, message) {
			failures.set(`${service}.${method}`, message);
		},

		handler(service, method, params) {
			const key = `${service}.${method}`;
			u.calls.push(key);
			const failure = failures.get(key);
			if (failure) throw new Error(failure);

			switch (key) {
				case "sales.findOutreachCandidate":
					return u.candidates.get(params.lang) ?? null;
				case "sales.recordEvent": {
					const id = `event-${u.events.length + 1}`;
					u.events.push({ ...params.event, id });
					return id;
				}
				case "sales.addTouch": {
					u.touches.push({ ...params.touch, id: u.touches.length + 1 });
					return u.touches.length;
				}
				case "ses.sendEmail":
				case "smtp.sendEmail": {
					if (u.sendError) return { success: false, error: u.sendError };
					u.transports.push(service);
					u.mails.push(params.payload);
					return { success: true, messageId: `msg-${++messageSeq}` };
				}
				default: {
					const answered = u.notify.handle(key, params);
					if (answered) return answered.value;
					throw new Error(`unexpected call ${key}`);
				}
			}
		},
	};

	return u;
}
