import { afterEach, describe, expect, test } from "bun:test";
import {
	LocaleController,
	loadSurfaceTranslations,
	registerSurfaceLocales,
	resetSurfaceI18nForTests,
	resolveEmbeddedSurfaceMessage,
} from "./i18n";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	LocaleController.getInstance().setLocale("en");
	resetSurfaceI18nForTests();
});

describe("surface translations", () => {
	test("hydrates the shared locale from a localized route", () => {
		expect(LocaleController.getInstance().hydrateFromPath("/ru/audit/42")).toBe(
			"ru",
		);
		expect(LocaleController.getInstance().getActiveLocale()).toBe("ru");
	});

	test("uses embedded messages without a network request", async () => {
		let fetches = 0;
		globalThis.fetch = (() => {
			fetches += 1;
			throw new Error("unexpected fetch");
		}) as typeof fetch;

		registerSurfaceLocales("auth-sf", {
			en: { welcome: { heading: "Welcome" } },
			ru: { welcome: { heading: "Добро пожаловать" } },
		});

		expect(await loadSurfaceTranslations("auth-sf", "ru")).toEqual({
			welcome: { heading: "Добро пожаловать" },
		});
		expect(fetches).toBe(0);
	});

	test("falls back to bundled English messages", async () => {
		registerSurfaceLocales("auth-sf", {
			en: { button: { submit: "Continue" } },
		});

		expect(await loadSurfaceTranslations("auth-sf", "de")).toEqual({
			button: { submit: "Continue" },
		});
	});

	test("keeps URL sources as a compatibility fallback", async () => {
		globalThis.fetch = (async (input) => {
			expect(String(input)).toBe("/legacy/auth/en.json");
			return Response.json({ welcome: { heading: "Legacy" } });
		}) as typeof fetch;
		LocaleController.getInstance().setLocales("auth-sf", {
			en: "/legacy/auth/en.json",
		});

		expect(await loadSurfaceTranslations("auth-sf", "en")).toEqual({
			welcome: { heading: "Legacy" },
		});
	});

	test("embedded registration replaces a legacy URL", async () => {
		LocaleController.getInstance().setLocales("auth-sf", {
			en: "/missing/auth/en.json",
		});
		registerSurfaceLocales("auth-sf", {
			en: { welcome: { heading: "Embedded" } },
		});

		expect(await loadSurfaceTranslations("auth-sf", "en")).toEqual({
			welcome: { heading: "Embedded" },
		});
	});

	test("resolves nested embedded messages synchronously for action metadata", () => {
		registerSurfaceLocales("orders-sf", {
			en: { actions: { orders: { brief: "Open orders" } } },
		});

		expect(
			resolveEmbeddedSurfaceMessage(
				"orders-sf",
				"actions.orders.brief",
				"en",
			),
		).toBe("Open orders");
	});
});
