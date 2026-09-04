import { describe, expect, test } from "bun:test";
import { ObjectRegistry } from "./registry";

describe("object registry module metadata", () => {
	test("keeps module descriptions from the object index LLM catalog", () => {
		const registry = new ObjectRegistry();
		registry.ingest({
			modules: {
				sales: {
					module: "sf-sales",
					manifest: {
						id: "sf-sales",
						types: [],
						views: [],
						operations: [],
					},
					llm: {
						actions: {
							"leads.show": {
								brief: "Show leads",
								description: "Show leads selected for a campaign",
								category: "sales",
								exposure: "user",
								priority: "primary",
							},
						},
					},
				},
			},
		});

		expect(registry.moduleDescription("sf-sales")).toBe(
			"Show leads selected for a campaign",
		);
	});

	test("prefers an explicit module description", () => {
		const registry = new ObjectRegistry();
		registry.ingest({
			modules: {
				sales: {
					module: "sf-sales",
					manifest: {
						id: "sf-sales",
						types: [],
						views: [],
						operations: [],
					},
					llm: {
						description: "Leads, contacts, audiences and campaigns",
						actions: {},
					},
				},
			},
		});

		expect(registry.moduleDescription("sf-sales")).toBe(
			"Leads, contacts, audiences and campaigns",
		);
	});
});
