// wf-sales-review-outreach — flow only, one mail per run. Asks rp-sales for the
// next lead that finished an order and has not been asked for a review yet,
// renders the review request from the `sales-review-outreach` template in
// rp-notify, sends it and records the trail (lead event + touch + delivery
// journal). dryRun renders the mail and stops before sending.
//
// The old workflow spelled every branch as its own build-*-result node class;
// here the branches are plain returns and the wording is a template in
// rp-notify, one per language, like every other letter.
// Service methods used: sales.findOutreachCandidate / recordEvent / addTouch,
// notify.getTemplate / getProfile / recordSend, ses.sendEmail (or smtp) — all
// of them already exist, nothing new is needed in the MS.
//
// No mail credentials here: the lambda reads them from its own environment.

import "dag-core/env";

import { pickLang, renderMail, substitute } from "dag-mail";
import { createNotifyServiceRtClient } from "g-notify/rt";
import { ContactType, createSalesServiceRtClient } from "g-sales/rt";
import { createSesServiceRtClient } from "g-ses/rt";
import { createSmtpServiceRtClient } from "g-smtp/rt";

const notify = createNotifyServiceRtClient();
const sales = createSalesServiceRtClient();
const ses = createSesServiceRtClient();
const smtp = createSmtpServiceRtClient();

const TEMPLATE_ID = "sales-review-outreach";

const DEFAULTS = {
	/** Not a letter: the line written on the lead's touch, for the sales team. */
	touchDescriptionTemplate:
		"Review outreach email sent to {{recipientEmail}}; messageId={{messageId}}",
	reviewUrl: "",
	googleMapsReviewUrl: "",
	dryRun: false,
};

type Input = Partial<typeof DEFAULTS> & {
	/** Which lead queue to take from; also the letter's language. */
	lang: string;
	/** Envelope sender; left out, the lambda uses the deployment's MAIL_FROM. */
	from?: string;
	/** Which relay the deployment runs; not a credential. Defaults to ses. */
	transport?: "ses" | "smtp";
};

const hex8 = (n: number): string => (n >>> 0).toString(16).padStart(8, "0");

/** Tracking code for the lead-event funnel (was randomUUID; node:crypto does
 *  not exist in QuickJS). Only ever called inside a node, so a replay keeps
 *  the same code instead of minting a second one. */
function trackingCode(): string {
	let out = "";
	for (let i = 0; i < 4; i++)
		out += hex8(Math.floor(Math.random() * 0x100000000));
	return out;
}

rt.workflow = (input: Input) => {
	if (!(input?.lang ?? "").trim())
		throw new Error("sales-review-outreach requires params.lang");

	const o = { ...DEFAULTS, ...input };
	const lang = input.lang.trim();

	const candidate = rt.node(`find-candidate:${lang}`, () =>
		sales.findOutreachCandidate(lang),
	);
	if (!candidate?.lead || !candidate.contact) {
		const result = { status: "no-candidate", lang };
		rt.set("sales-review-outreach:last-result", result);
		return result;
	}

	const { lead, contact } = candidate;
	if (contact.type !== ContactType.EMAIL || !(contact.value ?? "").trim()) {
		const result = {
			status: "candidate-has-no-email",
			lang,
			leadId: lead.id,
			contactId: contact.id,
		};
		rt.set("sales-review-outreach:last-result", result);
		return result;
	}

	const template = rt.node(`read-template:${TEMPLATE_ID}`, () =>
		notify.getTemplate(TEMPLATE_ID),
	);
	if (!template)
		throw new Error(
			`mail template "${TEMPLATE_ID}" is not seeded; run \`notify template seed\``,
		);
	const profile = rt.node("read-profile", () => notify.getProfile());
	const mailLang = pickLang(template, [lead.lang, lang, profile.lang]);

	// The tracking code is random, so the whole draft lives in one node: a
	// replay must reuse the very same code instead of rolling a new one.
	const email = rt.node(`build-email:${contact.id}`, () => {
		const code = trackingCode();
		const mail = renderMail(template, mailLang, {
			brand: profile.brand,
			supportEmail: profile.supportEmail ?? "",
			address: profile.address ?? "",
			leadId: lead.id,
			leadDescription: lead.description,
			recipientEmail: contact.value,
			reviewUrl: o.reviewUrl,
			googleMapsReviewUrl: o.googleMapsReviewUrl,
			trackingCode: code,
		});
		return {
			trackingCode: code,
			lang: mail.lang,
			subject: mail.subject,
			html: mail.html,
			text: mail.text,
		};
	});

	const preview = {
		lang,
		leadId: lead.id,
		contactId: contact.id,
		recipientEmail: contact.value,
		/** the language the letter is in; `lang` above is the queue it came from */
		letterLang: email.lang,
		subject: email.subject,
		trackingCode: email.trackingCode,
	};

	if (o.dryRun) {
		const result = {
			...preview,
			status: "ready",
			dryRun: true,
			body: email.text,
		};
		rt.set("sales-review-outreach:last-result", result);
		rt.log(
			`sales-review-outreach: DRY-RUN ${contact.value} — ${email.subject}`,
		);
		return result;
	}

	const payload = {
		from: input.from,
		to: contact.value,
		subject: email.subject,
		body: email.html,
		text: email.text,
		type: "html" as const,
	};
	const sent = rt.node(`send-email:${contact.id}`, () =>
		input.transport === "smtp"
			? smtp.sendEmail(payload)
			: ses.sendEmail(payload),
	);

	rt.attempt(`journal:${contact.id}`, () =>
		notify.recordSend({
			templateId: TEMPLATE_ID,
			channel: "email",
			recipient: contact.value,
			params: {
				leadId: lead.id,
				trackingCode: email.trackingCode,
				lang: email.lang,
			},
			status: sent.success ? "sent" : "failed",
		}),
	);

	// The lambda reports a refused mail as { success: false }, not as a throw —
	// so this is a normal branch, not an error boundary.
	if (!sent.success) {
		const result = { ...preview, status: "send-failed", error: sent.error };
		rt.set("sales-review-outreach:last-result", result);
		rt.log(
			`sales-review-outreach: send failed for ${contact.value} — ${sent.error}`,
		);
		return result;
	}

	rt.node(`record-event:${contact.id}`, () =>
		sales.recordEvent({
			id: "",
			code: email.trackingCode,
			type: "email_sent",
			leadId: lead.id,
			contactId: contact.id,
			url: o.reviewUrl || null,
			referrer: null,
			userAgent: null,
			createdAt: new Date(),
		}),
	);

	const description = substitute(o.touchDescriptionTemplate, {
		leadId: lead.id,
		leadDescription: lead.description,
		leadLang: lead.lang,
		leadType: String(lead.type),
		contactId: contact.id,
		recipientEmail: contact.value,
		contactRole: contact.role ?? "",
		contactDescription: contact.description ?? "",
		messageId: sent.messageId ?? "",
		reviewUrl: o.reviewUrl,
		googleMapsReviewUrl: o.googleMapsReviewUrl,
		trackingCode: email.trackingCode,
	});

	rt.node(`add-touch:${contact.id}`, () =>
		sales.addTouch({
			id: 0,
			contactId: contact.id,
			description,
			createdAt: new Date(),
		}),
	);

	const result = {
		...preview,
		status: "sent",
		messageId: sent.messageId,
	};
	rt.set("sales-review-outreach:last-result", result);
	rt.log(
		`sales-review-outreach: sent ${sent.messageId} to ${contact.value} (lead ${lead.id})`,
	);
	return result;
};
