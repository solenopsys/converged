import { expect, test } from "bun:test";
import { registry } from "./registry";
import {
	ingestFunctionIndex,
	ingestMicrofrontendLlmCatalog,
	moduleForAction,
} from "./function-index";

test("the function index remains the authoritative microfrontend owner", () => {
	const actionId = "trace-owner-test.open";
	const ghostId = "trace-owner-test.ghost";

	ingestFunctionIndex({
		modules: {
			traceOwner: {
				module: "mf-trace-owner-test",
				brief: "Trace owner test",
				functions: [
					{
						id: actionId,
						brief: "Open test",
						description: "Open the test action",
						category: "trace",
						exposure: "llm",
						priority: "normal",
					},
				],
			},
		},
	});

	ingestMicrofrontendLlmCatalog("trace-owner-test-mf", "", {
		actions: {
			[actionId]: {
				brief: "Open test",
				description: "Open the test action",
				category: "trace",
				exposure: "llm",
				priority: "normal",
			},
			[ghostId]: {
				brief: "Ghost",
				description: "Not implemented by the microfrontend",
				category: "trace",
				exposure: "llm",
				priority: "normal",
			},
		},
	});

	expect(moduleForAction(actionId)).toBe("mf-trace-owner-test");
	expect(registry.meta(ghostId)).toBeUndefined();
});
