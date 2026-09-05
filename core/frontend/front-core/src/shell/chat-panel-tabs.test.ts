import { describe, expect, test } from "bun:test";
import { availableChatPanelTabs, resolveChatPanelTab } from "./chat-panel-tabs";

describe("chat panel tabs", () => {
	test("a guest still gets the menu: navigation is not gated on a session", () => {
		const tabs = availableChatPanelTabs({
			isAuthenticated: false,
			isDevelopment: false,
		});

		expect(tabs.map((tab) => tab.id)).toEqual(["navigation", "chat"]);
		expect(resolveChatPanelTab("events", tabs)).toBe("chat");
	});

	test("a guest retains the development log", () => {
		const tabs = availableChatPanelTabs({
			isAuthenticated: false,
			isDevelopment: true,
		});

		expect(tabs.map((tab) => tab.id)).toEqual(["navigation", "chat", "trace"]);
	});

	test("an account sees the authenticated tabs", () => {
		const tabs = availableChatPanelTabs({
			isAuthenticated: true,
			isDevelopment: false,
		});

		expect(tabs.map((tab) => tab.id)).toEqual(["navigation", "chat", "events"]);
	});
});
