import { expect, test } from "bun:test";
import { $actionCatalog, registry } from "./registry";
import {
	ingestFunctionIndex,
	ingestSurfaceLlmCatalog,
	moduleForAction,
} from "./function-index";

test("the function index remains the authoritative surface owner", () => {
	const actionId = "trace-owner-test.open";
	const ghostId = "trace-owner-test.ghost";

	ingestFunctionIndex({
		modules: {
			traceOwner: {
				module: "sf-trace-owner-test",
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

	ingestSurfaceLlmCatalog("trace-owner-test-sf", "", {
		root: { surface: "sf-trace-owner-test", baseType: "trace" },
		actions: {
			[actionId]: {
				brief: "Open test",
				description: "Open the test action",
				category: "trace",
				exposure: "llm",
				priority: "normal",
				examples: { en: ["open the trace test"] },
			},
			[ghostId]: {
				brief: "Ghost",
				description: "Not implemented by the surface",
				category: "trace",
				exposure: "llm",
				priority: "normal",
			},
		},
	});

	expect(moduleForAction(actionId)).toBe("sf-trace-owner-test");
	expect(registry.meta(ghostId)).toBeUndefined();
	expect(registry.meta(actionId)).toMatchObject({
		root: { surface: "sf-trace-owner-test", baseType: "trace" },
		examples: { en: ["open the trace test"] },
	});
	expect($actionCatalog.getState().find((action) => action.id === actionId)).toMatchObject({
		root: { surface: "sf-trace-owner-test", baseType: "trace" },
		examples: { en: ["open the trace test"] },
	});
});
