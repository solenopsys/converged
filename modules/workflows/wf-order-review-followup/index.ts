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
//
// The wording is the `order-review-followup` template in rp-notify, in the
// language the first ask went out in, falling back to the company's.

import "dag-core/env";

import { pickLang, renderMail } from "dag-mail";
import { createNotifyServiceRtClient } from "g-notify/rt";
import { createOrdersServiceRtClient } from "g-orders/rt";
import { createReviewsServiceRtClient } from "g-reviews/rt";
import { createSesServiceRtClient } from "g-ses/rt";
import { createSmtpServiceRtClient } from "g-smtp/rt";

const notify = createNotifyServiceRtClient();
const orders = createOrdersServiceRtClient();
const reviews = createReviewsServiceRtClient();
const ses = createSesServiceRtClient();
const smtp = createSmtpServiceRtClient();

const TEMPLATE_ID = "order-review-followup";

type Input = {
	/** Envelope sender; left out, lm-ses uses the deployment's MAIL_FROM. */
	from?: string;
	/** Which relay the deployment runs; not a credential. Defaults to ses. */
	transport?: "ses" | "smtp";
	/** The name in the letter; left out, the company's brand from the profile. */
	shopName?: string;
	/** Overrides the settings for a one-off catch-up. */
	delayDays?: number;
	maxFollowups?: number;
	dryRun?: boolean;
};

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

	const template = rt.node(`read-template:${TEMPLATE_ID}`, () =>
		notify.getTemplate(TEMPLATE_ID),
	);
	if (!template)
		throw new Error(
			`mail template "${TEMPLATE_ID}" is not seeded; run \`notify template seed\``,
		);
	const profile = rt.node("read-profile", () => notify.getProfile());
	const lang = pickLang(template, [
		invite.lang,
		order?.customerLang,
		profile.lang,
	]);

	const brand = (input.shopName ?? "").trim() || profile.brand;
	const mail = renderMail(template, lang, {
		orderId: invite.orderId,
		orderName: order?.modelName ?? invite.orderId,
		customerName: (order?.customerName ?? "").trim(),
		customerEmail: invite.contact,
		brand,
		shopName: brand,
		supportEmail: profile.supportEmail ?? "",
		address: profile.address ?? "",
		reviewUrl: reviewUrlOf(settings.publicFormUrl, invite.token),
	});
	const subject = mail.subject;

	if (input.dryRun) {
		const result = {
			status: "ready",
			dryRun: true,
			inviteId: invite.id,
			orderId: invite.orderId,
			recipientEmail: invite.contact,
			lang,
			subject,
			body: mail.text,
		};
		rt.set("order-review-followup:last-result", result);
		rt.log(`order-review-followup: DRY-RUN ${invite.contact} (${invite.id})`);
		return result;
	}

	const payload = {
		from: input.from,
		to: invite.contact,
		subject,
		body: mail.html,
		text: mail.text,
		type: "html" as const,
	};
	const sent = rt.node(`send-email:${invite.id}`, () =>
		input.transport === "smtp"
			? smtp.sendEmail(payload)
			: ses.sendEmail(payload),
	);

	rt.attempt(`journal:${invite.id}`, () =>
		notify.recordSend({
			templateId: TEMPLATE_ID,
			channel: "email",
			recipient: invite.contact,
			params: { orderId: invite.orderId, inviteId: invite.id, lang },
			status: sent.success ? "sent" : "failed",
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
