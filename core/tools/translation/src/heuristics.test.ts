import { describe, expect, test } from "bun:test";
import {
	isShortTranslatableString,
	isTechnicalString,
	isUntranslated,
	matchesScript,
	normalizeText,
	pathKey,
} from "./heuristics";

describe("pathKey", () => {
	test("reads the last segment, and the one before it on request", () => {
		expect(pathKey("/blocks/0/title")).toBe("title");
		expect(pathKey("/blocks/0/title", 2)).toBe("0");
	});

	test("unescapes JSON-pointer segments", () => {
		expect(pathKey("/a~1b")).toBe("a/b");
		expect(pathKey("/a~0b")).toBe("a~b");
	});

	test("an empty path has no key", () => {
		expect(pathKey("")).toBe("");
	});
});

describe("normalizeText", () => {
	test("collapses whitespace so reflowing is not a difference", () => {
		expect(normalizeText("  a   b \n c ")).toBe("a b c");
	});
});

describe("matchesScript", () => {
	test("decides by which script dominates", () => {
		expect(matchesScript("Привет мир", "cyrillic")).toBe(true);
		expect(matchesScript("Hello world", "cyrillic")).toBe(false);
		expect(matchesScript("Bambu Lab", "latin")).toBe(true);
	});

	test("a mostly-Cyrillic string with a Latin brand still counts as Cyrillic", () => {
		expect(matchesScript("Принтер Bambu подключён", "cyrillic")).toBe(true);
	});
});

describe("isTechnicalString", () => {
	test("keys that name machine-facing values", () => {
		expect(isTechnicalString("/icon", "bell")).toBe(true);
		expect(isTechnicalString("/id", "hero-main")).toBe(true);
		expect(isTechnicalString("/note", "Choose your delivery method")).toBe(
			false,
		);
	});

	test("values that are plainly not prose", () => {
		expect(isTechnicalString("/x", "https://example.com")).toBe(true);
		expect(isTechnicalString("/x", "/images/logo.svg")).toBe(true);
		expect(isTechnicalString("/x", "streamline:bell")).toBe(true);
		expect(isTechnicalString("/x", "hero.json")).toBe(true);
		expect(isTechnicalString("/x", "SCREAMING_CASE")).toBe(true);
		expect(isTechnicalString("/x", "12 000 (+5%)")).toBe(true);
		expect(isTechnicalString("/x", "   ")).toBe(true);
	});

	test("configured paths are silenced wholesale", () => {
		expect(
			isTechnicalString("/diagram/caption", "Real prose", ["/diagram"]),
		).toBe(true);
		expect(
			isTechnicalString("/other/caption", "Real prose", ["/diagram"]),
		).toBe(false);
	});
});

describe("isShortTranslatableString", () => {
	test("known prose keys, directly or one level up", () => {
		expect(isShortTranslatableString("/title")).toBe(true);
		expect(isShortTranslatableString("/nav/0")).toBe(true);
		expect(isShortTranslatableString("/someUnknownKey")).toBe(false);
	});

	test("a project can add its own", () => {
		expect(
			isShortTranslatableString("/tab", { shortUnchangedStringKeys: ["tab"] }),
		).toBe(true);
	});
});

describe("isUntranslated", () => {
	const long = "Choose how you would like to be notified about new orders.";

	test("identical long prose counts", () => {
		expect(isUntranslated("/note", long, long)).toBe(true);
	});

	test("differing text never counts", () => {
		expect(isUntranslated("/note", long, "Совсем другой текст здесь.")).toBe(
			false,
		);
	});

	test("whitespace-only differences still count as untranslated", () => {
		expect(isUntranslated("/note", long, `  ${long.replace(" ", "  ")} `)).toBe(
			true,
		);
	});

	test("short unknown keys are below the threshold", () => {
		expect(isUntranslated("/whatever", "Home", "Home")).toBe(false);
		expect(isUntranslated("/label", "Home", "Home")).toBe(true);
	});

	test("the length threshold is configurable", () => {
		expect(
			isUntranslated("/whatever", "Short text", "Short text", {
				minUnchangedStringLength: 4,
			}),
		).toBe(true);
	});

	test("text already in the target script is left alone", () => {
		const cyrillic = "Выберите способ получения уведомлений о заказах.";
		expect(
			isUntranslated(
				"/note",
				cyrillic,
				cyrillic,
				{
					sameTextScriptByLocale: { ru: "cyrillic" },
				},
				"ru",
			),
		).toBe(false);
	});
});
