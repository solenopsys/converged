// wf-order-review-request — contour 2 of the review system, one mail per run.
//
// Finds an order that was finished long enough ago, has a customer to write to
// and has never been asked, mints the personal one-shot link for it in
// rp-reviews, and sends the ask through lm-ses. The join between "finished
// orders" and "already asked" is the whole reason this is a workflow: rp-orders
// does not know what a review is and rp-reviews does not know what an order is,
// so nobody but a flow may put the two lists side by side.
//
// One run = one mail, so a stuck address never blocks the queue behind it, and
// the schedule decides the rate. dryRun renders the mail and mints nothing.
//
// Services used: orders.listOrders, reviews.getSettings / listInvites /
// createInvite / patchInvite, ses.sendEmail — all of them already exist.
//
// No mail credentials here: lm-ses reads them from its own environment. A flow
// is a global script with no environment, so a credential it carried would have
// arrived through the browser and the assistant's tool catalogue.

import "dag-core/env";

import { createOrdersServiceRtClient } from "g-orders/rt";
import { createReviewsServiceRtClient } from "g-reviews/rt";
import { createSesServiceRtClient } from "g-ses/rt";

const orders = createOrdersServiceRtClient();
const reviews = createReviewsServiceRtClient();
const ses = createSesServiceRtClient();

/** How many finished orders one run looks at before giving up for now. */
const BATCH = 50;

type Input = {
	/** Envelope sender; left out, lm-ses uses the deployment's MAIL_FROM. */
	from?: string;
	shopName?: string;
	/** Overrides the delay held in the shop's settings, for a one-off catch-up. */
	delayHours?: number;
	dryRun?: boolean;
};

function renderTemplate(
	template: string,
	vars: Record<string, string>,
): string {
	return template.replace(
		/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
		(_m: string, key: string) => vars[key] ?? "",
	);
}

/** `publicFormUrl` may or may not end in a slash; the token appends either way. */
function reviewUrlOf(base: string, token: string): string {
	const trimmed = (base ?? "").trim();
	if (!trimmed) return token;
	return trimmed.endsWith("/") ? `${trimmed}${token}` : `${trimmed}/${token}`;
}

rt.workflow = (input: Input) => {
	const settings = rt.node("read-settings", () => reviews.getSettings());
	const delayHours = input.delayHours ?? settings.requestDelayHours;
	const cutoff = new Date(Date.now() - delayHours * 3600_000).toISOString();

	// Finished, and left alone since — an order that completed a minute ago is
	// still being packed, and asking then reads as asking about the packing.
	const finished = rt.node(`list-finished:${cutoff}`, () =>
		orders.listOrders({
			offset: 0,
			limit: BATCH,
			status: "completed",
			filter: { updatedAt: { lte: cutoff } },
		}),
	);

	const candidates = (finished.items ?? []).filter((order: any) =>
		(order.customerEmail ?? "").trim(),
	);
	if (candidates.length === 0) {
		const result = {
			status: "no-candidate",
			scanned: finished.items?.length ?? 0,
		};
		rt.set("order-review-request:last-result", result);
		return result;
	}

	// The one cross-service question of this flow: which of these were asked.
	const asked = rt.node(`list-invites:${cutoff}`, () =>
		reviews.listInvites({
			offset: 0,
			limit: BATCH,
			orderIds: candidates.map((order: any) => order.id),
		}),
	);
	const askedIds: Record<string, boolean> = {};
	for (const invite of asked.items ?? []) askedIds[invite.orderId] = true;

	const order = candidates.find((entry: any) => !askedIds[entry.id]);
	if (!order) {
		const result = {
			status: "all-asked",
			scanned: candidates.length,
		};
		rt.set("order-review-request:last-result", result);
		return result;
	}

	const shopName = (input.shopName ?? "").trim();
	const vars: Record<string, string> = {
		orderId: order.id,
		orderName: order.modelName ?? order.id,
		customerName: (order.customerName ?? "").trim(),
		customerEmail: order.customerEmail,
		shopName,
		reviewUrl: "",
	};

	if (input.dryRun) {
		// Nothing is minted: a rehearsal that leaves a live one-shot link behind
		// would have the next real run skip this order as already asked.
		const result = {
			status: "ready",
			dryRun: true,
			orderId: order.id,
			recipientEmail: order.customerEmail,
			subject: renderTemplate(settings.subjectTemplate, vars),
			body: renderTemplate(settings.bodyTemplate, {
				...vars,
				reviewUrl: reviewUrlOf(settings.publicFormUrl, "<token>"),
			}),
		};
		rt.set("order-review-request:last-result", result);
		rt.log(
			`order-review-request: DRY-RUN ${order.customerEmail} (${order.id})`,
		);
		return result;
	}

	const invite = rt.node(`create-invite:${order.id}`, () =>
		reviews.createInvite({
			orderId: order.id,
			contact: order.customerEmail,
			lang: order.customerLang,
		}),
	);
	vars.reviewUrl = reviewUrlOf(settings.publicFormUrl, invite.token);

	const subject = renderTemplate(settings.subjectTemplate, vars);
	const body = renderTemplate(settings.bodyTemplate, vars);

	const sent = rt.node(`send-email:${invite.id}`, () =>
		ses.sendEmail({
			from: input.from,
			to: order.customerEmail,
			subject,
			body,
			type: "text",
		}),
	);

	// lm-ses reports a refused mail as { success: false }, not as a throw — so
	// this is a normal branch, not an error boundary.
	if (!sent.success) {
		rt.node(`mark-failed:${invite.id}`, () =>
			reviews.patchInvite(invite.id, {
				status: "failed",
				error: sent.error ?? "send failed",
			}),
		);
		const result = {
			status: "send-failed",
			orderId: order.id,
			inviteId: invite.id,
			recipientEmail: order.customerEmail,
			error: sent.error,
		};
		rt.set("order-review-request:last-result", result);
		rt.log(
			`order-review-request: send failed for ${order.customerEmail} — ${sent.error}`,
		);
		return result;
	}

	rt.node(`mark-sent:${invite.id}`, () =>
		reviews.patchInvite(invite.id, {
			status: "sent",
			sentAt: new Date().toISOString(),
		}),
	);

	const result = {
		status: "sent",
		orderId: order.id,
		inviteId: invite.id,
		recipientEmail: order.customerEmail,
		subject,
		messageId: sent.messageId,
	};
	rt.set("order-review-request:last-result", result);
	rt.log(
		`order-review-request: asked ${order.customerEmail} about order ${order.id}`,
	);
	return result;
};
