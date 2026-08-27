import { afterEach, describe, expect, test } from "bun:test";
import {
	LocaleController,
	loadMicrofrontendTranslations,
	registerMicrofrontendLocales,
	resetMicrofrontendI18nForTests,
} from "./i18n";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	resetMicrofrontendI18nForTests();
});

describe("microfrontend translations", () => {
	test("uses embedded messages without a network request", async () => {
		let fetches = 0;
		globalThis.fetch = (() => {
			fetches += 1;
			throw new Error("unexpected fetch");
		}) as typeof fetch;

		registerMicrofrontendLocales("auth-mf", {
			en: { welcome: { heading: "Welcome" } },
			ru: { welcome: { heading: "Добро пожаловать" } },
		});

		expect(await loadMicrofrontendTranslations("auth-mf", "ru")).toEqual({
			welcome: { heading: "Добро пожаловать" },
		});
		expect(fetches).toBe(0);
	});

	test("falls back to bundled English messages", async () => {
		registerMicrofrontendLocales("auth-mf", {
			en: { button: { submit: "Continue" } },
		});

		expect(await loadMicrofrontendTranslations("auth-mf", "de")).toEqual({
			button: { submit: "Continue" },
		});
	});

	test("keeps URL sources as a compatibility fallback", async () => {
		globalThis.fetch = (async (input) => {
			expect(String(input)).toBe("/legacy/auth/en.json");
			return Response.json({ welcome: { heading: "Legacy" } });
		}) as typeof fetch;
		LocaleController.getInstance().setLocales("auth-mf", {
			en: "/legacy/auth/en.json",
		});

		expect(await loadMicrofrontendTranslations("auth-mf", "en")).toEqual({
			welcome: { heading: "Legacy" },
		});
	});

	test("embedded registration replaces a legacy URL", async () => {
		LocaleController.getInstance().setLocales("auth-mf", {
			en: "/missing/auth/en.json",
		});
		registerMicrofrontendLocales("auth-mf", {
			en: { welcome: { heading: "Embedded" } },
		});

		expect(await loadMicrofrontendTranslations("auth-mf", "en")).toEqual({
			welcome: { heading: "Embedded" },
		});
	});
});
