import { describe, expect, test } from "bun:test";
import { selectionFilterSchema } from "./schema";

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
});
