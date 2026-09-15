// wf-order-review-followup — the single chase, one mail per run.
//
// Takes a link that was sent, went quiet for the configured number of days and
// has not been chased its allowance of times, and asks once more. The choosing
// is rp-reviews' own — `findInvitesToFollowUp` is a question about invites and
// nothing else — so all this flow adds is the order's name for the mail and the
// sending itself, which is again two services and therefore a workflow.
//
// What it deliberately never does is chase somebody who opened the form: they
// read the ask and decided not to write, and asking again is how a review
// request becomes spam. That condition lives in the repository query, where it
// cannot be forgotten by a caller.

import "dag-core/env";

import { createOrdersServiceRtClient } from "g-orders/rt";
import { createReviewsServiceRtClient } from "g-reviews/rt";
import { createSesServiceRtClient } from "g-ses/rt";

const orders = createOrdersServiceRtClient();
const reviews = createReviewsServiceRtClient();
const ses = createSesServiceRtClient();

type Input = {
	/** Envelope sender; left out, lm-ses uses the deployment's MAIL_FROM. */
	from?: string;
	shopName?: string;
	/** Overrides the settings for a one-off catch-up. */
	delayDays?: number;
	maxFollowups?: number;
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

function reviewUrlOf(base: string, token: string): string {
	const trimmed = (base ?? "").trim();
	if (!trimmed) return token;
	return trimmed.endsWith("/") ? `${trimmed}${token}` : `${trimmed}/${token}`;
}

rt.workflow = (input: Input) => {
	const settings = rt.node("read-settings", () => reviews.getSettings());
	const delayDays = input.delayDays ?? settings.followupDelayDays;
	const maxFollowups = input.maxFollowups ?? settings.maxFollowups;

	if (maxFollowups <= 0) {
		const result = { status: "disabled" };
		rt.set("order-review-followup:last-result", result);
		return result;
	}

	const due = rt.node(`find-due:${delayDays}:${maxFollowups}`, () =>
		reviews.findInvitesToFollowUp(delayDays, maxFollowups, 1),
	);
	const invite = (due ?? [])[0];
	if (!invite) {
		const result = { status: "nothing-due" };
		rt.set("order-review-followup:last-result", result);
		return result;
	}

	// The order is read only for the name that goes in the mail; a deleted one
	// is not a reason to fail, it is a reason to say "your order".
	const order = rt.node(`read-order:${invite.orderId}`, () =>
		orders.getOrder(invite.orderId),
	);

	const vars: Record<string, string> = {
		orderId: invite.orderId,
		orderName: order?.modelName ?? invite.orderId,
		customerName: (order?.customerName ?? "").trim(),
		customerEmail: invite.contact,
		shopName: (input.shopName ?? "").trim(),
		reviewUrl: reviewUrlOf(settings.publicFormUrl, invite.token),
	};

	const subject = renderTemplate(settings.followupSubjectTemplate, vars);
	const body = renderTemplate(settings.followupBodyTemplate, vars);

	if (input.dryRun) {
		const result = {
			status: "ready",
			dryRun: true,
			inviteId: invite.id,
			orderId: invite.orderId,
			recipientEmail: invite.contact,
			subject,
			body,
		};
		rt.set("order-review-followup:last-result", result);
		rt.log(`order-review-followup: DRY-RUN ${invite.contact} (${invite.id})`);
		return result;
	}

	const sent = rt.node(`send-email:${invite.id}`, () =>
		ses.sendEmail({
			from: input.from,
			to: invite.contact,
			subject,
			body,
			type: "text",
		}),
	);

	if (!sent.success) {
		// The link is left `sent`, not `failed`: the first mail did go out, and
		// marking the whole invitation failed because a chase bounced would lose
		// a customer who may still answer the original.
		const result = {
			status: "send-failed",
			inviteId: invite.id,
			orderId: invite.orderId,
			recipientEmail: invite.contact,
			error: sent.error,
		};
		rt.set("order-review-followup:last-result", result);
		rt.log(
			`order-review-followup: send failed for ${invite.contact} — ${sent.error}`,
		);
		return result;
	}

	// Counting the chase is what makes it the *single* chase: the same query
	// that found this link will not return it again.
	rt.node(`count-followup:${invite.id}`, () =>
		reviews.patchInvite(invite.id, {
			followupCount: invite.followupCount + 1,
			lastFollowupAt: new Date().toISOString(),
		}),
	);

	const result = {
		status: "sent",
		inviteId: invite.id,
		orderId: invite.orderId,
		recipientEmail: invite.contact,
		followupCount: invite.followupCount + 1,
		messageId: sent.messageId,
	};
	rt.set("order-review-followup:last-result", result);
	rt.log(
		`order-review-followup: chased ${invite.contact} about order ${invite.orderId}`,
	);
	return result;
};
