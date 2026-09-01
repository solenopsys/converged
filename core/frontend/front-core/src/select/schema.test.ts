import { describe, expect, test } from "bun:test";
import { selectCommandSchema, selectionFilterSchema } from "./schema";

describe("selection filter schema", () => {
	test("publishes service value IDs together with readable labels", () => {
		const schema = selectionFilterSchema({
			filters: [
				{
					id: "companyTypeId",
					label: "Company type",
					valueType: "string",
					operators: ["eq"],
					options: [
						{
							id: "type-cnc",
							label: "CNC",
							aliases: ["computer numerical control"],
						},
					],
				},
			],
		});

		const value = (
			schema.properties as Record<
				string,
				{ properties: Record<string, unknown> }
			>
		).companyTypeId.properties.eq as {
			enum: string[];
			description: string;
		};
		expect(value.enum).toEqual(["type-cnc"]);
		expect(value.description).toContain("CNC");
		expect(value.description).toContain('"type-cnc"');
	});

	test("publishes parameters only for presets that declare them", () => {
		const schema = selectCommandSchema({
			filters: [],
			presets: [
				{ id: "all", label: "All" },
				{
					id: "campaign",
					label: "Campaign",
					parameters: {
						type: "object",
						properties: { campaignId: { type: "string" } },
						required: ["campaignId"],
					},
				},
			],
		});
		const presets = (
			schema.properties as Record<string, { items: { oneOf: unknown } }>
		).presets;
		expect(presets.items.oneOf).toEqual([
			{
				type: "object",
				description: "all: All",
				properties: { id: { type: "string", enum: ["all"] } },
				required: ["id"],
				additionalProperties: false,
			},
			{
				type: "object",
				description: "campaign: Campaign",
				properties: {
					id: { type: "string", enum: ["campaign"] },
					params: {
						type: "object",
						properties: { campaignId: { type: "string" } },
						required: ["campaignId"],
					},
				},
				required: ["id"],
				additionalProperties: false,
			},
		]);
	});
});
