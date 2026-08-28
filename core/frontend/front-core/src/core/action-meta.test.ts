import { describe, expect, test } from "bun:test";
import { resolveActionMeta } from "./action-meta";

describe("action LLM metadata", () => {
	test("uses the language-independent manifest fields", () => {
		const meta = resolveActionMeta({
			id: "orders.show",
			brief: "Open orders",
			description: "Open the orders workspace",
			exposure: "user",
			priority: "primary",
		});

		expect(meta.brief).toBe("Open orders");
		expect(meta.description).toBe("Open the orders workspace");
		expect(meta.exposure).toBe("user");
		expect(meta.priority).toBe("primary");
	});
});
