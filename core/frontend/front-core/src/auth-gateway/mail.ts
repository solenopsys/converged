// Magic-link delivery. The transport is a deployment choice (AWS SES or a plain
// SMTP relay) — both are supported and selected by MAIL_TRANSPORT; the
// credentials for the selected one are required, with no silent fallback.
//
// The letter is the `magic-link` struct entry, rendered by dag-mail. It is the first
// thing any customer sees of the product, so it goes out in their language:
// the account's, else the invitation's, else what their browser asked for,
// else the company's.
import { settings } from "back-core/settings";
import { MAIL_LANGS, renderMail } from "dag-mail";
import {
	identityClient,
	notifyClient,
	sesClient,
	smtpClient,
	structClient,
} from "./clients";

const TEMPLATE_ID = "magic-link";

async function loadMagicLinkTemplate(lang: string): Promise<{
	id: string;
	content: Record<string, string>;
}> {
	const struct = structClient();
	for (const candidate of [lang, "en"]) {
		try {
			const value = await struct.readJson(
				`${candidate}/templates/magic-link.json`,
			);
			if (value && typeof value === "object") {
				return { id: TEMPLATE_ID, content: { [candidate]: JSON.stringify(value) } };
			}
		} catch {}
	}
	return { id: TEMPLATE_ID, content: {} };
}

function preferredLang(
	userLang: string | undefined,
	inviteLang: string | undefined,
	acceptLanguage: string | undefined,
	profileLang: string,
): string {
	for (const candidate of [
		userLang,
		inviteLang,
		...acceptedLangs(acceptLanguage),
		profileLang,
	]) {
		const normalized = String(candidate ?? "").trim().toLowerCase();
		if (MAIL_LANGS.includes(normalized as (typeof MAIL_LANGS)[number]))
			return normalized;
		const base = normalized.split("-")[0];
		if (MAIL_LANGS.includes(base as (typeof MAIL_LANGS)[number])) return base;
	}
	return "en";
}

export type MagicLinkEmail = {
	to: string;
	link: string;
	/** the request's Accept-Language, as a hint when the account has no language */
	acceptLanguage?: string;
	/** the request's User-Agent, shown back so a stranger's request stands out */
	userAgent?: string;
};

/** `de-CH,de;q=0.9,en;q=0.8` → `["de-ch", "de", "en"]`, best first. */
export function acceptedLangs(header: string | undefined): string[] {
	return String(header ?? "")
		.split(",")
		.map((part) => {
			const [tag, ...params] = part.trim().split(";");
			const q = params.find((p) => p.trim().startsWith("q="));
			return {
				tag: tag.trim().toLowerCase(),
				q: q ? Number(q.split("=")[1]) : 1,
			};
		})
		.filter((entry) => entry.tag && entry.tag !== "*" && entry.q > 0)
		.sort((a, b) => b.q - a.q)
		.map((entry) => entry.tag);
}

/** "Firefox, Linux" — enough to recognise one's own device, and no more. */
export function describeClient(userAgent: string | undefined): string {
	const ua = String(userAgent ?? "");
	if (!ua) return "";
	const browser = /Edg\//.test(ua)
		? "Edge"
		: /OPR\//.test(ua)
			? "Opera"
			: /Firefox\//.test(ua)
				? "Firefox"
				: /Chrome\//.test(ua)
					? "Chrome"
					: /Safari\//.test(ua)
						? "Safari"
						: "";
	const os = /iPhone|iPad/.test(ua)
		? "iOS"
		: /Android/.test(ua)
			? "Android"
			: /Mac OS X/.test(ua)
				? "macOS"
				: /Windows/.test(ua)
					? "Windows"
					: /Linux/.test(ua)
						? "Linux"
						: "";
	return [browser, os].filter(Boolean).join(", ");
}

function requestedAt(lang: string, now: Date): string {
	try {
		return (
			new Intl.DateTimeFormat(lang, {
				dateStyle: "long",
				timeStyle: "short",
				timeZone: "UTC",
			}).format(now) + " UTC"
		);
	} catch {
		return `${now.toISOString().slice(0, 16).replace("T", " ")} UTC`;
	}
}

export async function sendMagicLinkEmail(email: MagicLinkEmail): Promise<void> {
	const notify = notifyClient();
	const profile = await notify.getProfile();

	const identity = identityClient();
	const [user, invite] = await Promise.all([
		identity.getUserByEmail(email.to).catch(() => null),
		identity.getInviteByEmail(email.to).catch(() => null),
	]);
	const lang = preferredLang(
		user?.lang,
		invite?.lang,
		email.acceptLanguage,
		profile.lang,
	);
	const template = await loadMagicLinkTemplate(lang);
	// Loud, not a bare three-line fallback: a missing source is found on its
	// first sign-in rather than after months of letters nobody designed.
	if (Object.keys(template.content).length === 0) {
		throw new Error(
			`[auth-gateway] struct template "${TEMPLATE_ID}" is missing`,
		);
	}

	const mail = renderMail(template, lang, {
		brand: profile.brand,
		supportEmail: profile.supportEmail ?? "",
		address: profile.address ?? "",
		url: email.link,
		email: email.to,
		requestInfo: [
			requestedAt(lang, new Date()),
			describeClient(email.userAgent),
		]
			.filter(Boolean)
			.join(" · "),
	});

	const transport = settings.mail.transport();
	const payload = {
		from: settings.mail.from(),
		to: email.to,
		subject: mail.subject,
		body: mail.html,
		text: mail.text,
		type: "html" as const,
	};

	const result =
		transport === "ses"
			? await sesClient().sendEmail(payload, settings.mail.ses())
			: await smtpClient().sendEmail(payload, settings.mail.smtp());

	// The journal is written either way and never fails the sign-in: whether
	// the letter left is the question support gets asked.
	await notify
		.recordSend({
			templateId: TEMPLATE_ID,
			channel: "email",
			recipient: email.to,
			params: { lang, transport },
			status: result.success ? "sent" : "failed",
		})
		.catch((error) =>
			console.warn("[auth-gateway] delivery journal failed", error),
		);

	if (!result.success) {
		throw new Error(
			`[auth-gateway] ${transport} delivery failed: ${result.error ?? "unknown error"}`,
		);
	}
}
