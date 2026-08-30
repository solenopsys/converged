import { afterEach, describe, expect, test } from "bun:test";
import { translate } from "i18n";
import { resetCatalogForTests } from "../../../libraries/i18n/src/catalog";
import { resetI18nForTests } from "../../../libraries/i18n/src/locale";
import { bootstrapChatMessagesDefaults, initChatMessages } from "./i18n";

// The i18n locale/catalog stores are process-wide singletons, and every other
// module that reads the "chat" namespace (AppShell, Composer, tab-actions,
// ...) configures them exactly once, at import time. Resetting here without
// restoring leaves those modules broken for the rest of the test run.
afterEach(() => {
	resetCatalogForTests();
	resetI18nForTests();
	bootstrapChatMessagesDefaults();
});

describe("chat messages", () => {
	test("uses bundled messages without a remote source", () => {
		initChatMessages(undefined, "en");

		expect(translate("chat", "step.thinking")).toBe("Thinking...");
		expect(translate("chat", "step.acting")).toBe("Working...");
	});

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
