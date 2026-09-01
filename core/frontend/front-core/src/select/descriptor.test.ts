import { describe, expect, test } from "bun:test";
import type { ObjectTypeDefinition } from "../object-runtime";
import { loadSelectionDescriptor, selectionDefinition } from "./descriptor";

describe("selection descriptor", () => {
	test("replaces the MF fallback with fields supplied by the service", async () => {
		const type: ObjectTypeDefinition = {
			id: "test.machine",
			label: "Machine",
			selection: {
				filters: [
					{
						id: "stale",
						label: "Stale",
						valueType: "string",
						operators: ["eq"],
					},
				],
				describe: async () => ({
					fields: [
						{
							id: "process",
							label: "Process",
							valueType: "enum",
							operators: ["eq", "in"],
							control: "multi-select",
							values: [{ id: "sls", label: "SLS" }],
						},
					],
				}),
			},
		};

		expect(selectionDefinition(type)?.filters[0]?.id).toBe("stale");
		await loadSelectionDescriptor(type);
		expect(selectionDefinition(type)?.filters).toEqual([
			{
				id: "process",
				label: "Process",
				valueType: "string",
				operators: ["eq", "in"],
				control: "multi-select",
				options: [{ id: "sls", label: "SLS" }],
			},
		]);
	});

	test("refreshes server capabilities when requested by the orchestrator", async () => {
		let revision = 0;
		const type: ObjectTypeDefinition = {
			id: "test.live-machine",
			label: "Machine",
			selection: {
				filters: [],
				describe: async () => {
					revision += 1;
					return {
						fields: [
							{
								id: `field-${revision}`,
								label: "Dynamic field",
								valueType: "string" as const,
								operators: ["eq"],
							},
						],
					};
				},
			},
		};

		await loadSelectionDescriptor(type);
		expect(selectionDefinition(type)?.filters[0]?.id).toBe("field-1");
		await loadSelectionDescriptor(type, true);
		expect(selectionDefinition(type)?.filters[0]?.id).toBe("field-2");
	});
});
