import { beforeEach, describe, expect, test } from "bun:test";
import { resetCatalogForTests } from "./catalog";
import {
	configureI18n,
	loadMessages,
	locale,
	registerMessages,
	setLocale,
	setMessageSource,
	translate,
	translator,
} from "./index";
import { resetI18nForTests } from "./locale";

const LOCALES = ["en", "ru", "de"] as const;

beforeEach(() => {
	resetCatalogForTests();
	resetI18nForTests();
	configureI18n({ locales: LOCALES, defaultLocale: "en" });
});

describe("locale", () => {
	test("throws before configuration instead of guessing", () => {
		resetI18nForTests();
		expect(() => locale()).toThrow(/Not configured/);
	});

	test("rejects an unpublished locale", () => {
		expect(() => setLocale("jp")).toThrow(/Unsupported locale/);
		expect(locale()).toBe("en");
	});

	test("defaultLocale must be one of locales", () => {
		resetI18nForTests();
		expect(() => configureI18n({ locales: ["en"], defaultLocale: "ru" })).toThrow(
			/not in locales/,
		);
	});
});

describe("translate", () => {
	test("reads the current locale, nested paths included", () => {
		registerMessages("chat", "en", { step: { think: "Thinking…" } });
		registerMessages("chat", "ru", { step: { think: "Думаю…" } });

		expect(translate("chat", "step.think")).toBe("Thinking…");
		setLocale("ru");
		expect(translate("chat", "step.think")).toBe("Думаю…");
	});

	test("falls back to the default locale, not to empty", () => {
		registerMessages("chat", "en", { only: "English only" });
		setLocale("de");
		expect(translate("chat", "only")).toBe("English only");
	});

	test("an untranslated key stays visible", () => {
		expect(translate("chat", "nothing.here")).toBe("nothing.here");
	});

	test("interpolates the published placeholder format", () => {
		registerMessages("ui", "en", { states: "Active regions: {count}" });
		expect(translate("ui", "states", { count: 23 })).toBe("Active regions: 23");
	});

	test("leaves placeholders it was not given", () => {
		registerMessages("ui", "en", { states: "Active regions: {count}" });
		expect(translate("ui", "states")).toBe("Active regions: {count}");
	});

	test("namespaces do not clobber each other", () => {
		registerMessages("a", "en", { title: "A" });
		registerMessages("b", "en", { title: "B" });
		expect(translate("a", "title")).toBe("A");
		expect(translate("b", "title")).toBe("B");
	});

	test("a later load merges into what is registered", () => {
		registerMessages("chat", "en", { first: "one" });
		registerMessages("chat", "en", { second: "two" });
		expect(translate("chat", "first")).toBe("one");
		expect(translate("chat", "second")).toBe("two");
	});

	test("translator binds a namespace", () => {
		registerMessages("chat", "en", { hi: "Hi" });
		expect(translator("chat")("hi")).toBe("Hi");
	});
});

describe("source", () => {
	test("loads a namespace once", async () => {
		let calls = 0;
		setMessageSource(async (namespace, forLocale) => {
			calls++;
			return { where: `${namespace}/${forLocale}` };
		});

		await loadMessages("chat");
		await loadMessages("chat");
		expect(calls).toBe(1);
		expect(translate("chat", "where")).toBe("chat/en");
	});

	test("a failed load does not lock the namespace", async () => {
		let attempt = 0;
		setMessageSource(async () => {
			attempt++;
			if (attempt === 1) throw new Error("network");
			return { ok: "loaded" };
		});

		await expect(loadMessages("chat")).rejects.toThrow("network");
		await loadMessages("chat");
		expect(translate("chat", "ok")).toBe("loaded");
	});

	test("loading without a source fails loudly", async () => {
		await expect(loadMessages("chat")).rejects.toThrow(/No message source/);
	});
});
