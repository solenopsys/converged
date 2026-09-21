import { describe, expect, test } from "bun:test";
import { hooks } from "./case.hooks.ts";

describe("CASE adapter", () => {
	test("encodes a context load without provider logic in Zig", () => {
		const wire = hooks.encodeTurn({
			model: "case",
			maxTokens: 1,
			messages: [],
			tools: [],
			requireTool: false,
			operation: "context.load",
			input: { key: "club", sections: [] },
		});
		expect(wire.path).toBe("/contexts");
		expect(JSON.parse(wire.body)).toEqual({ key: "club", sections: [] });
	});

	test("encodes the last user message as a route request", () => {
		const wire = hooks.encodeTurn({
			model: "case",
			maxTokens: 1,
			messages: [
				{ role: "system", content: "ignore" },
				{ role: "user", content: "show incoming mail" },
			],
			tools: [],
			requireTool: false,
			input: { context: "club", language: "en" },
		});
		expect(wire.path).toBe("/route");
		expect(JSON.parse(wire.body)).toEqual({
			context: "club",
			language: "en",
			text: "show incoming mail",
		});
	});

	test("turns an EXECUTE response into a uniform tool call", () => {
		const reply = hooks.decodeResponse({
			decision: "EXECUTE",
			command: "mailing.incoming.show",
		});
		expect(reply.toolCalls).toEqual([
			{ id: "case-route", name: "mailing.incoming.show", args: {} },
		]);
	});
});
