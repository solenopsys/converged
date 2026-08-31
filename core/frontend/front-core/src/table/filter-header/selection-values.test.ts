import { describe, expect, test } from "bun:test";
import { valuesFromSelectionFilter } from "./selection-values";

describe("valuesFromSelectionFilter", () => {
	test("maps simple server predicates to their matching controls", () => {
		expect(
			valuesFromSelectionFilter(
				[
					{ id: "companyTypeId", type: "multi-select" },
					{ id: "status", type: "select" },
				],
				{
					filter: {
						companyTypeId: { eq: "cnc" },
						status: { eq: "active" },
					},
				},
			),
		).toEqual({ companyTypeId: ["cnc"], status: "active" });
	});

	test("does not flatten logical server predicates into a different query", () => {
		expect(
			valuesFromSelectionFilter([{ id: "status", type: "select" }], {
				filter: { AND: [{ status: { eq: "active" } }] },
			}),
		).toEqual({});
	});
});
