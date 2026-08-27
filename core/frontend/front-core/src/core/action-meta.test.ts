import { afterEach, describe, expect, test } from "bun:test";
import { LocaleController, resetMicrofrontendI18nForTests } from "../i18n";
import { resolveActionMeta } from "./action-meta";

afterEach(() => {
	LocaleController.getInstance().setLocale("en");
	resetMicrofrontendI18nForTests();
});

describe("action LLM metadata", () => {
	test("uses indexed locale fragments before a microfrontend is loaded", () => {
		LocaleController.getInstance().setLocale("ru");
		const meta = resolveActionMeta({
			id: "orders.show",
			llm: {
				microfrontend: "orders-mf",
				brief: "llm.actions.show.brief",
				description: "llm.actions.show.description",
				messages: {
					en: { brief: "Open orders", description: "Open the orders workspace" },
					ru: { brief: "Открыть заказы", description: "Открыть рабочее место заказов" },
				},
			},
		});

		expect(meta.brief).toBe("Открыть заказы");
		expect(meta.description).toBe("Открыть рабочее место заказов");
	});
});
