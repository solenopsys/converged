import { describe, expect, test } from "bun:test";
import { ObjectRegistry } from "./registry";

describe("object registry surface identity", () => {
	test("a declared surface names itself before its module is loaded", () => {
		const registry = new ObjectRegistry();
		registry.ingest({
			modules: {
				sales: {
					module: "sf-sales",
					manifest: {
						id: "sf-sales",
						label: "Sales",
						purpose: "Leads, contacts, audiences and campaigns",
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

		expect(registry.surface("sf-sales")).toEqual({
			id: "sf-sales",
			label: "Sales",
			purpose: "Leads, contacts, audiences and campaigns",
			hidden: false,
			loaded: false,
		});
		// The purpose is the surface's own line. It used to be every action
		// description joined by "; " — a paragraph where one line was needed.
		expect(registry.moduleDescription("sf-sales")).toBe(
			"Leads, contacts, audiences and campaigns",
		);
	});

	test("registering the module marks the same surface loaded", () => {
		const registry = new ObjectRegistry();
		registry.ingest({
			modules: {
				sales: {
					module: "sf-sales",
					manifest: {
						id: "sf-sales",
						label: "Sales",
						purpose: "Leads, contacts, audiences and campaigns",
						types: [],
						views: [],
						operations: [],
					},
					llm: { actions: {} },
				},
			},
		});

		registry.register("sf-sales", {
			id: "sf-sales",
			label: "Sales",
			purpose: "Leads, contacts, audiences and campaigns",
			types: [],
			views: [],
			operations: [],
		});

		expect(registry.surface("sf-sales")?.loaded).toBe(true);
		expect(registry.allSurfaces()).toHaveLength(1);
	});
});
