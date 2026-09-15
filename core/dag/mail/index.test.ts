import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MAIL_LANGS, type MailTemplate, pickLang, renderMail } from "./index";

const SHIPPED_DIR = join(import.meta.dir, "../../../modules/commands/mail");

function shipped(): MailTemplate[] {
	return readdirSync(SHIPPED_DIR)
		.filter((file) => file.endsWith(".json"))
		.map((file) => ({
			id: file.replace(/\.json$/, ""),
			content: JSON.parse(readFileSync(join(SHIPPED_DIR, file), "utf8")),
		}));
}

const VARS = {
	brand: "Acme Works",
	supportEmail: "help@acme.test",
	address: "1 Example St",
	url: "https://acme.test/auth/verify?token=T1",
	email: "ann@acme.test",
	requestInfo: "Firefox, Linux",
	name: "Ann",
	consoleUrl: "https://acme.test/console",
	customerName: "Ann",
	orderName: "Bracket",
	reviewUrl: "https://acme.test/review/T1",
	googleMapsReviewUrl: "https://maps.test/r",
};

const letter: MailTemplate = {
	id: "sample",
	content: {
		en: JSON.stringify({
			subject: "Hi {{name}}",
			preheader: "pre",
			heading: "Hello",
			cta: "Go",
			blocks: [
				{ p: "Dear {{name}}", when: "name" },
				{ p: "Dear customer", when: "!name" },
				{ button: "{{url}}" },
				{ p: "See [the console]({{consoleUrl}})." },
				{ fallback: "{{url}}", label: "Button broken" },
			],
			footer: ["{{brand}}", { text: "{{address}}", when: "address" }],
		}),
		ru: { subject: "Привет", blocks: [{ p: "Текст" }] },
	},
};

describe("renderMail", () => {
	test("renders subject, html and a text alternative from the same data", () => {
		const mail = renderMail(letter, "en", {
			name: "Ann",
			url: "https://x.test/?a=1&b=2",
			consoleUrl: "https://x.test/console",
			brand: "Acme",
		});
		expect(mail.subject).toBe("Hi Ann");
		expect(mail.lang).toBe("en");
		expect(mail.html).toContain('<html lang="en">');
		expect(mail.html).toContain('href="https://x.test/?a=1&amp;b=2"');
		expect(mail.html).toContain(
			'<a href="https://x.test/console">the console</a>',
		);
		expect(mail.html).not.toContain("Dear customer");
		expect(mail.text).toContain("Go:\nhttps://x.test/?a=1&b=2");
		expect(mail.text).toContain("See the console (https://x.test/console).");
		// The text part has no button to fail, so the fallback is not repeated.
		expect(mail.text).not.toContain("Button broken");
		expect(mail.text).toContain("--\nAcme");
	});

	test("escapes variables in html but not the template", () => {
		const mail = renderMail(letter, "en", { name: "<b>Ann</b>", url: "u" });
		expect(mail.html).toContain("Dear &lt;b&gt;Ann&lt;/b&gt;");
		expect(mail.text).toContain("Dear <b>Ann</b>");
	});

	test("when / !when pick the line that fits", () => {
		const mail = renderMail(letter, "en", { url: "u" });
		expect(mail.html).toContain("Dear customer");
		expect(mail.html).not.toContain("1 Example");
	});

	test("falls back recipient → base language → en", () => {
		expect(pickLang(letter, ["ru-RU"])).toBe("ru");
		expect(pickLang(letter, ["de", "ru"])).toBe("ru");
		expect(pickLang(letter, ["xx", undefined, ""])).toBe("en");
		expect(renderMail(letter, "fr", { name: "A", url: "u" }).lang).toBe("en");
	});

	test("refuses to render nothing", () => {
		expect(() => renderMail({ id: "empty", content: {} }, "en", {})).toThrow(
			/no content/,
		);
		expect(() =>
			renderMail({ id: "bad", content: { en: "{not json" } }, "en", {}),
		).toThrow(/not valid JSON/);
	});
});

describe("shipped templates", () => {
	const templates = shipped();

	test("exist", () => {
		expect(templates.map((tpl) => tpl.id).sort()).toEqual([
			"magic-link",
			"order-review-followup",
			"order-review-request",
			"sales-review-outreach",
			"team-invite",
		]);
	});

	for (const tpl of templates) {
		test(`${tpl.id} speaks every surface language and leaves no placeholder behind`, () => {
			expect(Object.keys(tpl.content).sort()).toEqual([...MAIL_LANGS].sort());
			for (const lang of MAIL_LANGS) {
				const mail = renderMail(tpl, lang, VARS);
				expect(mail.lang).toBe(lang);
				expect(mail.subject.length).toBeGreaterThan(0);
				for (const part of [mail.subject, mail.html, mail.text]) {
					expect(part).not.toMatch(/\{\{|\}\}|\]\(/);
				}
				expect(mail.html).toContain(`<html lang="${lang}">`);
				expect(mail.text).toContain("Acme Works");
			}
		});
	}
});
