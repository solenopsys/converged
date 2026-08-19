import { describe, expect, test } from "bun:test";
import { createResonusCommandTransport } from "./resonus-transport";

describe("Resonus browser transport", () => {
	test("maps commands and stream payloads to NRPC envelopes", async () => {
		const requests: Array<{ method: string; payload: unknown }> = [];
		const transport = createResonusCommandTransport({
			requestEnvelope: async (message) => {
				requests.push(message);
				return { kind: "response" };
			},
			requestEnvelopeStream: async function* (message) {
				requests.push(message);
				yield {
					kind: "streamChunk",
					payload: { type: "text.delta", text: "ok" },
				};
			},
		});

		await transport.command("session.open", { sessionId: "session-1" });
		const events: unknown[] = [];
		for await (const event of transport.stream("llm.generate", {
			contextId: "context-1",
		})) {
			events.push(event);
		}

		expect(requests.map(({ method }) => method)).toEqual([
			"session.open",
			"llm.generate",
		]);
		expect(events).toEqual([{ type: "text.delta", text: "ok" }]);
	});

	test("surfaces an envelope error", async () => {
		const transport = createResonusCommandTransport({
			requestEnvelope: async () => ({ kind: "error", error: "unavailable" }),
			requestEnvelopeStream: async function* () {},
		});

		await expect(transport.command("session.open", {})).rejects.toThrow(
			"unavailable",
		);
	});
});
