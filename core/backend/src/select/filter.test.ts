import { describe, expect, test } from "bun:test";
import { combineFilters, parseFilter } from "./filter";
import { createJsonFilterAdapter } from "./json";
import type { FilterSchema } from "./types";

const schema: FilterSchema = {
	status: {
		valueType: "string",
		operators: ["eq", "in", "notEq"],
		values: ["active", "inactive", "pending"],
	},
	cityId: { valueType: "string", operators: ["eq", "in", "isNull"] },
	createdAt: { valueType: "date", operators: ["gte", "lt", "between"] },
	withoutScreenshot: { valueType: "boolean", operators: ["eq"] },
};

describe("select filters", () => {
	test("parses field conditions and logical groups", () => {
		expect(
			parseFilter(
				{
					status: { in: ["active", "pending"] },
					OR: [{ cityId: { eq: "1" } }, { cityId: { isNull: true } }],
				},
				schema,
			),
		).toEqual({
			kind: "group",
			operator: "and",
			items: [
				{
					kind: "condition",
					field: "status",
					operator: "in",
					value: ["active", "pending"],
				},
				{
					kind: "group",
					operator: "or",
					items: [
						{ kind: "condition", field: "cityId", operator: "eq", value: "1" },
						{ kind: "condition", field: "cityId", operator: "isNull" },
					],
				},
			],
		});
	});

	test("rejects fields, operators and values outside the schema", () => {
		expect(() => parseFilter({ unknown: { eq: "x" } }, schema)).toThrow(
			/unknown field/,
		);
		expect(() => parseFilter({ status: { contains: "act" } }, schema)).toThrow(
			/not supported/,
		);
		expect(() => parseFilter({ status: { eq: "removed" } }, schema)).toThrow(
			/unsupported value/,
		);
		expect(() =>
			parseFilter({ withoutScreenshot: { eq: "true" } }, schema),
		).toThrow(/must be a boolean/);
	});

	test("combines filters without nesting repeated and groups", () => {
		const left = parseFilter({ status: { eq: "active" } }, schema);
		const right = parseFilter({ withoutScreenshot: { eq: true } }, schema);
		expect(combineFilters(left, right)).toEqual({
			kind: "group",
			operator: "and",
			items: [
				{ kind: "condition", field: "status", operator: "eq", value: "active" },
				{
					kind: "condition",
					field: "withoutScreenshot",
					operator: "eq",
					value: true,
				},
			],
		});
	});

	test("uses the same AST against JSON records", () => {
		const adapter = createJsonFilterAdapter<{
			status: string;
			cityId?: string;
			withoutScreenshot: boolean;
		}>(schema);
		const rows = [
			{ status: "active", cityId: "1", withoutScreenshot: true },
			{ status: "active", cityId: "2", withoutScreenshot: false },
			{ status: "inactive", cityId: "1", withoutScreenshot: true },
		];
		expect(
			rows.filter(
				adapter.predicate({
					status: { eq: "active" },
					withoutScreenshot: { eq: true },
				}),
			),
		).toEqual([rows[0]]);
	});
});
