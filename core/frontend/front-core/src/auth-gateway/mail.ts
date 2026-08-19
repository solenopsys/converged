// Magic-link delivery. The transport is a deployment choice (AWS SES or a plain
// SMTP relay) — both are supported and selected by AUTH_MAIL_TRANSPORT; the
// credentials for the selected one are required, with no silent fallback.
import { settings } from "back-core/settings";
import { sesClient, smtpClient } from "./clients";

export type MagicLinkEmail = {
	to: string;
	link: string;
};

function body(link: string): string {
	return [
		"<p>Sign-in link:</p>",
		`<p><a href="${link}">${link}</a></p>`,
		"<p>If you did not request it, ignore this message.</p>",
	].join("\n");
}

export async function sendMagicLinkEmail(email: MagicLinkEmail): Promise<void> {
	const transport = settings.authMail.transport();
	const payload = {
		from: settings.authMail.from(),
		to: email.to,
		subject: "Sign-in link",
		body: body(email.link),
		type: "html" as const,
	};

	const result =
		transport === "ses"
			? await sesClient().sendEmail(payload, settings.authMail.ses())
			: await smtpClient().sendEmail(payload, settings.authMail.smtp());

	if (!result.success) {
		throw new Error(
			`[auth-gateway] ${transport} delivery failed: ${result.error ?? "unknown error"}`,
		);
	}
}
