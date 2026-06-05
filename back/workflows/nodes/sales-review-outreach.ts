import { randomUUID } from "node:crypto";
import type { INode } from "@rt/dag-api";
import {
	type Contact,
	ContactType,
	createSalesServiceClient,
	type Lead,
} from "g-sales";
import { createSmtpServiceClient, type SmtpCredentials } from "g-smtp";

export type SalesReviewOutreachParams = {
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

export class SalesReviewValidateParamsNode implements INode {
	constructor(public name: string) {}

	async execute(
		data: SalesReviewOutreachParams,
	): Promise<SalesReviewOutreachParams> {
		if (!data.lang?.trim()) throw new Error("lang is required");
		if (!data.from?.trim()) throw new Error("from is required");
		if (!data.smtp) throw new Error("smtp credentials are required");
		return data;
	}
}

export class SalesReviewFindCandidateNode implements INode {
	constructor(public name: string) {}

	async execute(data: SalesReviewOutreachParams): Promise<{
		lead: Lead | null;
		contact: Contact | null;
	}> {
		const sales = createSalesServiceClient({ baseUrl: data.servicesBaseUrl });
		const candidate = await sales.findOutreachCandidate(data.lang);
		return {
			lead: candidate?.lead ?? null,
			contact: candidate?.contact ?? null,
		};
	}
}

export class SalesReviewBuildNoCandidateResultNode implements INode {
	constructor(public name: string) {}

	async execute(
		data: SalesReviewOutreachParams,
	): Promise<Record<string, unknown>> {
		return { status: "no-candidate", lang: data.lang };
	}
}

export class SalesReviewBuildNoEmailResultNode implements INode {
	constructor(public name: string) {}

	async execute(data: {
		lead: Lead;
		contact: Contact;
	}): Promise<Record<string, unknown>> {
		return {
			status: "candidate-has-no-email",
			leadId: data.lead.id,
			contactId: data.contact.id,
		};
	}
}

export class SalesReviewCheckEmailContactNode implements INode {
	constructor(public name: string) {}

	async execute(data: { contact: Contact }): Promise<{ hasEmail: boolean }> {
		return {
			hasEmail:
				data.contact.type === ContactType.EMAIL &&
				Boolean(data.contact.value?.trim()),
		};
	}
}

export class SalesReviewBuildEmailNode implements INode {
	constructor(public name: string) {}

	async execute(data: {
		params: SalesReviewOutreachParams;
		lead: Lead;
		contact: Contact;
	}): Promise<{
		trackingCode: string;
		subject: string;
		body: string;
	}> {
		const trackingCode = randomUUID();
		const baseVars = candidateVars(data.lead, data.contact, {
			reviewUrl: data.params.reviewUrl ?? "",
			googleMapsReviewUrl: data.params.googleMapsReviewUrl ?? "",
			trackingCode,
		});

		return {
			trackingCode,
			subject: renderTemplate(
				data.params.subjectTemplate ?? DEFAULT_SUBJECT,
				baseVars,
			),
			body: renderTemplate(data.params.bodyTemplate ?? DEFAULT_BODY, baseVars),
		};
	}
}

export class SalesReviewBuildDryRunResultNode implements INode {
	constructor(public name: string) {}

	async execute(data: {
		lead: Lead;
		contact: Contact;
		subject: string;
		body: string;
	}): Promise<Record<string, unknown>> {
		return {
			status: "ready",
			dryRun: true,
			leadId: data.lead.id,
			contactId: data.contact.id,
			recipientEmail: data.contact.value,
			subject: data.subject,
			body: data.body,
		};
	}
}

export class SalesReviewSendEmailNode implements INode {
	constructor(public name: string) {}

	async execute(data: {
		params: SalesReviewOutreachParams;
		contact: Contact;
		subject: string;
		body: string;
	}): Promise<{ success: boolean; messageId?: string; error?: string }> {
		const smtp = createSmtpServiceClient({
			baseUrl: data.params.servicesBaseUrl,
		});
		return await smtp.sendEmail(
			{
				from: data.params.from,
				to: data.contact.value,
				subject: data.subject,
				body: data.body,
				type: data.params.emailType ?? "text",
			},
			data.params.smtp,
		);
	}
}

export class SalesReviewBuildSendFailedResultNode implements INode {
	constructor(public name: string) {}

	async execute(data: {
		lead: Lead;
		contact: Contact;
		error?: string;
	}): Promise<Record<string, unknown>> {
		return {
			status: "send-failed",
			leadId: data.lead.id,
			contactId: data.contact.id,
			recipientEmail: data.contact.value,
			error: data.error,
		};
	}
}

export class SalesReviewRecordOutreachNode implements INode {
	constructor(public name: string) {}

	async execute(data: {
		params: SalesReviewOutreachParams;
		lead: Lead;
		contact: Contact;
		trackingCode: string;
		messageId?: string;
	}): Promise<void> {
		const sales = createSalesServiceClient({
			baseUrl: data.params.servicesBaseUrl,
		});
		await sales.recordEvent({
			id: "",
			code: data.trackingCode,
			type: "email_sent",
			leadId: data.lead.id,
			contactId: data.contact.id,
			url: data.params.reviewUrl ?? null,
			createdAt: new Date(),
		});

		const touchDescription = renderTemplate(
			data.params.touchDescriptionTemplate ?? DEFAULT_TOUCH,
			candidateVars(data.lead, data.contact, {
				messageId: data.messageId ?? "",
				reviewUrl: data.params.reviewUrl ?? "",
				googleMapsReviewUrl: data.params.googleMapsReviewUrl ?? "",
				trackingCode: data.trackingCode,
			}),
		);
		await sales.addTouch({
			id: 0,
			contactId: data.contact.id,
			description: touchDescription,
			createdAt: new Date(),
		});
	}
}

export class SalesReviewBuildSentResultNode implements INode {
	constructor(public name: string) {}

	async execute(data: {
		lead: Lead;
		contact: Contact;
		messageId?: string;
		trackingCode: string;
		subject: string;
	}): Promise<Record<string, unknown>> {
		return {
			status: "sent",
			leadId: data.lead.id,
			contactId: data.contact.id,
			recipientEmail: data.contact.value,
			messageId: data.messageId,
			trackingCode: data.trackingCode,
			subject: data.subject,
		};
	}
}
