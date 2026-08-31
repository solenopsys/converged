import { describe, expect, test } from "bun:test";
import { setRef } from "../object-runtime";
import { applySelectCommand } from "./selection";

describe("applySelectCommand", () => {
	test("creates an unfiltered selection", () => {
		expect(
			applySelectCommand("companies.company", {
				scope: "new",
				mode: "replace",
			}),
		).toEqual(setRef("companies.company", { kind: "query" }));
	});

	test("refines the current selection without losing its filter", () => {
		const current = setRef("companies.company", {
			kind: "query",
			filter: { companyTypeId: { eq: "cnc" } },
		});
		expect(
			applySelectCommand(
				"companies.company",
				{
					scope: "current",
					mode: "refine",
					filter: { status: { eq: "active" } },
				},
				current,
			),
		).toEqual(
			setRef("companies.company", {
				kind: "query",
				filter: {
					AND: [{ companyTypeId: { eq: "cnc" } }, { status: { eq: "active" } }],
				},
			}),
		);
	});
});
