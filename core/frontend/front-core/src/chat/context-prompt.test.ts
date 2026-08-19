import { describe, expect, test } from "bun:test";
import { createContextPromptResolver } from "./context-prompt";

describe("createContextPromptResolver", () => {
	test("propagates a context-service failure instead of treating it as an empty prompt", async () => {
		const resolve = createContextPromptResolver(
			{
				getContext: async () => {
					throw new Error("forbidden");
				},
			},
			{ section: "route", requireSection: true },
		);

		await expect(resolve({ contextName: "chat", language: "en" })).rejects.toThrow(
			'Context "en/chat#route" unavailable: forbidden',
		);
	});
});
