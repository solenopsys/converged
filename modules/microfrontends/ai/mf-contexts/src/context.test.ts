import { describe, expect, test } from "bun:test";
import { contextFromRef, contextRef, newContextRef } from "./context";

describe("context references", () => {
	test("preserves the service identity", () => {
		const ref = contextRef({ name: "request/default", language: "pt-BR" });
		expect(contextFromRef(ref)).toEqual({
			name: "request/default",
			language: "pt-BR",
		});
	});

	test("keeps the draft separate from stored contexts", () => {
		expect(contextFromRef(newContextRef())).toBeUndefined();
	});
});
