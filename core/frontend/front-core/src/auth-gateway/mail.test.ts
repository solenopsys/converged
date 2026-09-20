import { beforeEach, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The magic link: the first letter any customer gets, so it is the one that
// has to be in their language and has to leave a trace in the journal.

const shipped = JSON.parse(
	readFileSync(
		join(
			import.meta.dir,
			"../../../../../modules/commands/mail/magic-link.json",
		),
		"utf8",
	),
);
const content: Record<string, string> = {};
for (const [lang, letter] of Object.entries(shipped))
	content[lang] = JSON.stringify(letter);

let profile = { lang: "en", brand: "Converge" } as Record<string, string>;
let users: Record<string, { lang?: string }> = {};
let invites: Record<string, { lang?: string }> = {};
let sendResult = { success: true, messageId: "m-1" } as {
	success: boolean;
	error?: string;
};
const sent: any[] = [];
const journal: any[] = [];

mock.module("back-core/settings", () => ({
	settings: {
		mail: {
			transport: () => "ses",
			from: () => "no-reply@acme.test",
			ses: () => ({ accessKeyId: "k", secretAccessKey: "s", region: "r" }),
			smtp: () => ({ host: "h", port: 25, secure: false }),
		},
	},
}));

mock.module("./clients", () => ({
	structClient: () => ({
		readJson: async (path: string) => {
			const lang = path.split("/")[0];
			const letter = content[lang];
			return letter ? JSON.parse(letter) : null;
		},
	}),
	notifyClient: () => ({
		getProfile: async () => profile,
		recordSend: async (input: unknown) => {
			journal.push(input);
			return "send-1";
		},
	}),
	identityClient: () => ({
		getUserByEmail: async (email: string) => users[email] ?? null,
		getInviteByEmail: async (email: string) => invites[email] ?? null,
	}),
	sesClient: () => ({
		sendEmail: async (payload: unknown) => {
			sent.push(payload);
			return sendResult;
		},
	}),
	smtpClient: () => ({ sendEmail: async () => sendResult }),
}));

const { sendMagicLinkEmail, acceptedLangs, describeClient } = await import(
	"./mail"
);

const LINK = "https://acme.test/auth/verify?token=abc";
const FIREFOX =
	"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0";

beforeEach(() => {
	profile = { lang: "en", brand: "Acme Works", supportEmail: "help@acme.test" };
	users = {};
	invites = {};
	sendResult = { success: true, messageId: "m-1" };
	sent.length = 0;
	journal.length = 0;
});

test("sends the designed letter with a text alternative", async () => {
	await sendMagicLinkEmail({
		to: "ann@acme.test",
		link: LINK,
		userAgent: FIREFOX,
	});

	expect(sent).toHaveLength(1);
	expect(sent[0]).toMatchObject({
		from: "no-reply@acme.test",
		to: "ann@acme.test",
		subject: "Sign in to Acme Works",
		type: "html",
	});
	expect(sent[0].body).toContain(`href="${LINK}"`);
	expect(sent[0].body).toContain("mailto:help@acme.test");
	expect(sent[0].text).toContain(LINK);
	expect(sent[0].text).toContain("Firefox, Linux");
	expect(journal).toEqual([
		expect.objectContaining({
			templateId: "magic-link",
			status: "sent",
			recipient: "ann@acme.test",
		}),
	]);
});

test("account language beats the browser, the browser beats the company", async () => {
	profile.lang = "it";
	users["ann@acme.test"] = { lang: "ru" };
	await sendMagicLinkEmail({
		to: "ann@acme.test",
		link: LINK,
		acceptLanguage: "de-DE,de;q=0.9",
	});
	expect(sent[0].subject).toBe("Вход в Acme Works");

	await sendMagicLinkEmail({
		to: "bob@acme.test",
		link: LINK,
		acceptLanguage: "zh-CN, fr;q=0.8",
	});
	expect(sent[1].subject).toBe("Connexion à Acme Works");

	invites["eve@acme.test"] = { lang: "pt-BR" };
	await sendMagicLinkEmail({ to: "eve@acme.test", link: LINK });
	expect(sent[2].subject).toBe("Acesso ao Acme Works");

	await sendMagicLinkEmail({ to: "joe@acme.test", link: LINK });
	expect(sent[3].subject).toBe("Accesso a Acme Works");
});

test("an unseeded template is an error, not a blank letter", async () => {
	const original = content.en;
	delete content.en;
	await expect(
		sendMagicLinkEmail({ to: "ann@acme.test", link: LINK }),
	).rejects.toThrow(/struct template/);
	expect(sent).toHaveLength(0);
	content.en = original;
});

test("a refused delivery is journalled and still thrown", async () => {
	sendResult = { success: false, error: "sandbox" };
	await expect(
		sendMagicLinkEmail({ to: "ann@acme.test", link: LINK }),
	).rejects.toThrow(/sandbox/);
	expect(journal[0]).toMatchObject({ status: "failed" });
});

test("reads Accept-Language and User-Agent the way people send them", () => {
	expect(acceptedLangs("de-CH,de;q=0.9,en;q=0.8,*;q=0.1")).toEqual([
		"de-ch",
		"de",
		"en",
	]);
	expect(acceptedLangs(undefined)).toEqual([]);
	expect(
		describeClient(
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
		),
	).toBe("Safari, macOS");
	expect(describeClient("")).toBe("");
});
