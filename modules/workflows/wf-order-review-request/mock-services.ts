// Mock rp-orders / rp-reviews / lm-ses universe for the review outreach tests
// (test-only, never bundled into a workflow). One CallHandler for the
// centimanus mock harness; state is plain in-memory arrays, so a test can
// assert on what the workflow actually wrote — the links it minted and the
// mails it sent.

import { createNotifyMock } from "../../../core/dag/mail/mock-notify";

export type MockOrder = {
	id: string;
	modelName: string;
	status: string;
	customerName?: string;
	customerEmail?: string;
	customerLang?: string;
	updatedAt: string;
};

export type MockInvite = {
	id: string;
	orderId: string;
	token: string;
	contact: string;
	lang?: string;
	status: string;
	followupCount: number;
	sentAt?: string;
	lastFollowupAt?: string;
	expiresAt: string;
	error?: string;
	createdAt: string;
	updatedAt: string;
};

export type MockSentMail = {
	from?: string;
	to: string;
	subject: string;
	body?: string;
	text?: string;
	type?: string;
};

const NOW = "2026-08-01T00:00:00.000Z";
const OLD = "2026-07-01T00:00:00.000Z";

export const DEFAULT_SETTINGS = {
	platforms: [],
	positiveThreshold: 4,
	requestDelayHours: 24,
	followupDelayDays: 5,
	maxFollowups: 1,
	inviteTtlDays: 30,
	publicFormUrl: "https://shop.test/review",
};

export type ReviewUniverse = {
	orders: MockOrder[];
	invites: MockInvite[];
	mails: MockSentMail[];
	settings: Record<string, unknown>;
	calls: string[];
	/** when set, ses.sendEmail answers { success: false, error } */
	sendError: string | null;
	/** what reviews.findInvitesToFollowUp hands out, in order */
	followupQueue: MockInvite[];
	/** rp-notify: templates from modules/commands/mail, profile, journal */
	notify: ReturnType<typeof createNotifyMock>;
	/** which relay the letters went through */
	transports: string[];

	addOrder(order: Partial<MockOrder>): MockOrder;
	addInvite(invite: Partial<MockInvite>): MockInvite;
	handler(service: string, method: string, params: any): unknown;
};

export function createReviewUniverse(): ReviewUniverse {
	let orderSeq = 0;
	let inviteSeq = 0;
	let messageSeq = 0;

	const u: ReviewUniverse = {
		orders: [],
		invites: [],
		mails: [],
		settings: { ...DEFAULT_SETTINGS },
		calls: [],
		sendError: null,
		followupQueue: [],
		notify: createNotifyMock(),
		transports: [],

		addOrder(order) {
			const entry: MockOrder = {
				id: `order-${++orderSeq}`,
				modelName: "Bracket",
				status: "completed",
				customerName: "Ann",
				customerEmail: "ann@example.com",
				customerLang: "en",
				updatedAt: OLD,
				...order,
			};
			u.orders.push(entry);
			return entry;
		},

		addInvite(invite) {
			const entry: MockInvite = {
				id: `invite-${++inviteSeq}`,
				orderId: "order-1",
				token: `token-${inviteSeq}`,
				contact: "ann@example.com",
				status: "queued",
				followupCount: 0,
				expiresAt: "2026-09-01T00:00:00.000Z",
				createdAt: NOW,
				updatedAt: NOW,
				...invite,
			};
			u.invites.push(entry);
			return entry;
		},

		handler(service, method, params) {
			const key = `${service}.${method}`;
			u.calls.push(key);

			switch (key) {
				case "reviews.getSettings":
					return u.settings;
				case "orders.listOrders": {
					const cutoff = params.params?.filter?.updatedAt?.lte;
					const items = u.orders.filter(
						(order) =>
							order.status === params.params?.status &&
							(!cutoff || order.updatedAt <= cutoff),
					);
					return { items, totalCount: items.length };
				}
				case "orders.getOrder":
					return u.orders.find((order) => order.id === params.id) ?? null;
				case "reviews.listInvites": {
					const ids: string[] = params.params?.orderIds ?? [];
					const items = u.invites.filter((invite) =>
						ids.includes(invite.orderId),
					);
					return { items, totalCount: items.length };
				}
				case "reviews.createInvite":
					return u.addInvite({
						orderId: params.input.orderId,
						contact: params.input.contact,
						lang: params.input.lang,
					});
				case "reviews.patchInvite": {
					const invite = u.invites.find((entry) => entry.id === params.id);
					if (invite) Object.assign(invite, params.patch);
					return null;
				}
				case "reviews.findInvitesToFollowUp":
					return u.followupQueue;
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
