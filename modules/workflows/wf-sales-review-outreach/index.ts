// wf-sales-review-outreach — flow only, one mail per run. Asks rp-sales for the
// next lead that finished an order and has not been asked for a review yet,
// renders the review request from the flow-local templates, sends it through
// lm-smtp and records the trail (lead event + touch). dryRun renders the mail
// and stops before sending.
//
// The old workflow spelled every branch as its own build-*-result node class;
// here the branches are plain returns and the templates are flow-local strings.
// Service methods used: sales.findOutreachCandidate / recordEvent / addTouch,
// smtp.sendEmail — all of them already exist, nothing new is needed in the MS.

import "dag-core/env";

import { ContactType, createSalesServiceRtClient } from "g-sales/rt";
import { createSmtpServiceRtClient, type SmtpCredentials } from "g-smtp/rt";

const sales = createSalesServiceRtClient();
const smtp = createSmtpServiceRtClient();

const DEFAULTS = {
	subjectTemplate: "Could you leave a quick review about your completed order?",
	bodyTemplate: [
		"Hi,",
		"",
		"Thank you for working with us. Could you leave a short review about your completed order?",
		"",
		"Review page: {{reviewUrl}}",
		"",
		"If everything was excellent, we will also help you share the review on Google Maps:",
		"{{googleMapsReviewUrl}}",
	].join("\n"),
	touchDescriptionTemplate:
		"Review outreach email sent to {{recipientEmail}}; messageId={{messageId}}",
	emailType: "text" as "html" | "text",
	reviewUrl: "",
	googleMapsReviewUrl: "",
	dryRun: false,
};

type Input = Partial<typeof DEFAULTS> & {
	lang: string;
	from: string;
	smtp: SmtpCredentials;
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
	if (!(input.from ?? "").trim())
		throw new Error("sales-review-outreach requires params.from");
	if (!input.smtp)
		throw new Error("sales-review-outreach requires params.smtp");

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

	// The tracking code is random, so the whole draft lives in one node: a
	// replay must reuse the very same code instead of rolling a new one.
	const email = rt.node(`build-email:${contact.id}`, () => {
		const code = trackingCode();
		const vars: Record<string, string> = {
			leadId: lead.id,
			leadDescription: lead.description,
			leadLang: lead.lang,
			leadType: String(lead.type),
			contactId: contact.id,
			recipientEmail: contact.value,
			contactRole: contact.role ?? "",
			contactDescription: contact.description ?? "",
			reviewUrl: o.reviewUrl,
			googleMapsReviewUrl: o.googleMapsReviewUrl,
			trackingCode: code,
		};
		return {
			trackingCode: code,
			subject: renderTemplate(o.subjectTemplate, vars),
			body: renderTemplate(o.bodyTemplate, vars),
		};
	});

	const preview = {
		lang,
		leadId: lead.id,
		contactId: contact.id,
		recipientEmail: contact.value,
		subject: email.subject,
		trackingCode: email.trackingCode,
	};

	if (o.dryRun) {
		const result = {
			...preview,
			status: "ready",
			dryRun: true,
			body: email.body,
		};
		rt.set("sales-review-outreach:last-result", result);
		rt.log(
			`sales-review-outreach: DRY-RUN ${contact.value} — ${email.subject}`,
		);
		return result;
	}

	const sent = rt.node(`send-email:${contact.id}`, () =>
		smtp.sendEmail(
			{
				from: input.from,
				to: contact.value,
				subject: email.subject,
				body: email.body,
				type: o.emailType,
			},
			input.smtp,
		),
	);

	// lm-smtp reports a refused mail as { success: false }, not as a throw —
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

	const description = renderTemplate(o.touchDescriptionTemplate, {
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
