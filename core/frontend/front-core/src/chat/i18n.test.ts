import { afterEach, describe, expect, test } from "bun:test";
import { translate } from "i18n";
import { resetCatalogForTests } from "../../../libraries/i18n/src/catalog";
import { resetI18nForTests } from "../../../libraries/i18n/src/locale";
import { initChatMessages } from "./i18n";

afterEach(() => {
	resetCatalogForTests();
	resetI18nForTests();
});

describe("chat messages", () => {
	test("uses bundled messages when the optional struct record is absent", async () => {
		initChatMessages(
			async () => {
				throw { errorCode: "NOT_FOUND" };
			},
			"en",
		);

		await Bun.sleep(0);
		expect(translate("chat", "step.thinking")).toBe("Thinking...");
		expect(translate("chat", "step.acting")).toBe("Working...");
	});
});
