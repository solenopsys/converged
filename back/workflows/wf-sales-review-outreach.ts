import { randomUUID } from "node:crypto";
import { Workflow } from "@rt/engines/dag";
import {
	type Contact,
	ContactType,
	createSalesServiceClient,
	type Lead,
} from "g-sales";
import { createSmtpServiceClient, type SmtpCredentials } from "g-smtp";

type SalesReviewOutreachParams = {
	lang: string;
	from: string;
	smtp: SmtpCredentials;
	subjectTemplate?: string;
	bodyTemplate?: string;
	touchDescriptionTemplate?: string;
	servicesBaseUrl?: string;
	dryRun?: boolean;
	emailType?: "html" | "text";
	reviewUrl?: string;
	googleMapsReviewUrl?: string;
};

type TemplateVars = Record<string, string>;

const DEFAULT_SUBJECT =
	"Could you leave a quick review about your completed order?";
const DEFAULT_BODY = [
	"Hi,",
	"",
	"Thank you for working with us. Could you leave a short review about your completed order?",
	"",
	"Review page: {{reviewUrl}}",
	"",
	"If everything was excellent, we will also help you share the review on Google Maps:",
	"{{googleMapsReviewUrl}}",
].join("\n");
const DEFAULT_TOUCH =
	"Review outreach email sent to {{recipientEmail}}; messageId={{messageId}}";

function renderTemplate(template: string, vars: TemplateVars): string {
	return template.replace(
		/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g,
		(_, key) => vars[key] ?? "",
	);
}

function candidateVars(
	lead: Lead,
	contact: Contact,
	extra: TemplateVars,
): TemplateVars {
	return {
		leadId: lead.id,
		leadDescription: lead.description,
		leadLang: lead.lang,
		leadType: lead.type,
		contactId: contact.id,
		recipientEmail: contact.value,
		contactRole: contact.role ?? "",
		contactDescription: contact.description ?? "",
		...extra,
	};
}

export class SalesReviewOutreachWorkflow extends Workflow {
	async execute(params: SalesReviewOutreachParams): Promise<void> {
		if (!params.lang?.trim()) throw new Error("lang is required");
		if (!params.from?.trim()) throw new Error("from is required");
		if (!params.smtp) throw new Error("smtp credentials are required");

		const sales = createSalesServiceClient({ baseUrl: params.servicesBaseUrl });
		const candidate = await this.invoke("find-outreach-candidate", () =>
			sales.findOutreachCandidate(params.lang),
		);

		if (!candidate) {
			const result = { status: "no-candidate", lang: params.lang };
			this.setVar("sales-review-outreach:last-result", result);
			await this.invoke("final-result", async () => result);
			return;
		}

		const { lead, contact } = candidate;
		if (contact.type !== ContactType.EMAIL || !contact.value?.trim()) {
			const result = {
				status: "candidate-has-no-email",
				leadId: lead.id,
				contactId: contact.id,
			};
			this.setVar("sales-review-outreach:last-result", result);
			await this.invoke("final-result", async () => result);
			return;
		}

		const trackingCode = randomUUID();
		const baseVars = candidateVars(lead, contact, {
			reviewUrl: params.reviewUrl ?? "",
			googleMapsReviewUrl: params.googleMapsReviewUrl ?? "",
			trackingCode,
		});
		const subject = renderTemplate(
			params.subjectTemplate ?? DEFAULT_SUBJECT,
			baseVars,
		);
		const body = renderTemplate(params.bodyTemplate ?? DEFAULT_BODY, baseVars);

		if (params.dryRun) {
			const result = {
				status: "ready",
				dryRun: true,
				leadId: lead.id,
				contactId: contact.id,
				recipientEmail: contact.value,
				subject,
				body,
			};
			this.setVar("sales-review-outreach:last-result", result);
			await this.invoke("final-result", async () => result);
			return;
		}

		const smtp = createSmtpServiceClient({ baseUrl: params.servicesBaseUrl });
		const sendResult = await this.invoke(`send-email-${contact.id}`, () =>
			smtp.sendEmail(
				{
					from: params.from,
					to: contact.value,
					subject,
					body,
					type: params.emailType ?? "text",
				},
				params.smtp,
			),
		);

		if (!sendResult.success) {
			const result = {
				status: "send-failed",
				leadId: lead.id,
				contactId: contact.id,
				recipientEmail: contact.value,
				error: sendResult.error,
			};
			this.setVar("sales-review-outreach:last-result", result);
			await this.invoke("final-result", async () => result);
			return;
		}

		await this.invoke(`record-event-${contact.id}`, () =>
			sales.recordEvent({
				id: "",
				code: trackingCode,
				type: "email_sent",
				leadId: lead.id,
				contactId: contact.id,
				url: params.reviewUrl ?? null,
				createdAt: new Date(),
			}),
		);

		const touchDescription = renderTemplate(
			params.touchDescriptionTemplate ?? DEFAULT_TOUCH,
			candidateVars(lead, contact, {
				messageId: sendResult.messageId ?? "",
				reviewUrl: params.reviewUrl ?? "",
				googleMapsReviewUrl: params.googleMapsReviewUrl ?? "",
				trackingCode,
			}),
		);
		await this.invoke(`add-touch-${contact.id}`, () =>
			sales.addTouch({
				id: 0,
				contactId: contact.id,
				description: touchDescription,
				createdAt: new Date(),
			}),
		);

		const result = {
			status: "sent",
			leadId: lead.id,
			contactId: contact.id,
			recipientEmail: contact.value,
			messageId: sendResult.messageId,
			trackingCode,
			subject,
		};
		this.setVar("sales-review-outreach:last-result", result);
		await this.invoke("final-result", async () => result);
	}
}

export const WORKFLOWS = [
	{ name: "sales-review-outreach", ctor: SalesReviewOutreachWorkflow },
];
