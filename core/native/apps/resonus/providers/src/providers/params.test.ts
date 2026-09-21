import { describe, expect, test } from "bun:test";
import { hooks } from "./params.hooks.ts";

describe("PARAMS adapter", () => {
	test("encodes format and variants with the last user message", () => {
		const wire = hooks.encodeTurn({
			model: "params",
			maxTokens: 1,
			messages: [
				{ role: "system", content: "ignore" },
				{ role: "user", content: "Active orders from today" },
			],
			tools: [],
			requireTool: false,
			input: {
				format: { status: { type: "string" } },
				variants: { status: ["active", "done"] },
			},
		});

		expect(wire.path).toBe("/params");
		expect(JSON.parse(wire.body)).toEqual({
			query: "Active orders from today",
			format: { status: { type: "string" } },
			variants: { status: ["active", "done"] },
		});
	});

	test("preserves an explicit query and decodes extracted fields", () => {
		const wire = hooks.encodeTurn({
			model: "params",
			maxTokens: 1,
			messages: [],
			tools: [],
			requireTool: false,
			input: { query: "Open order 157", format: { orderNumber: { type: "integer" } } },
		});
		expect(JSON.parse(wire.body)).toEqual({
			query: "Open order 157",
			format: { orderNumber: { type: "integer" } },
			variants: {},
		});
		expect(hooks.decodeResponse({ orderNumber: 157 }).text).toBe('{"orderNumber":157}');
	});
});
