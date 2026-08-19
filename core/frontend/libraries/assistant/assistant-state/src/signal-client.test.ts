import { describe, expect, test } from "bun:test";
import { createSignalAssistantClient } from "./signal-client";

describe("signal assistant client", () => {
	test("uses the explicit Resonus session id for the chat conversation", async () => {
		const client = createSignalAssistantClient(
			{
				requestEnvelopeStream: async function* () {},
			},
			{ sessionId: "session-shared-with-orchestrator" },
		);

		await expect(client.createSession()).resolves.toBe(
			"session-shared-with-orchestrator",
		);
	});
});
