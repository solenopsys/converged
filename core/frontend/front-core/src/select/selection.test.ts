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

	test("keeps opaque presets while refining a query", () => {
		const current = setRef("mailing.mail", {
			kind: "query",
			presets: [{ id: "incoming.responses" }],
		});
		expect(
			applySelectCommand(
				"mailing.mail",
				{
					scope: "current",
					mode: "refine",
					filter: { date: { gte: "2026-08-01" } },
				},
				current,
			),
		).toEqual(
			setRef("mailing.mail", {
				kind: "query",
				filter: { date: { gte: "2026-08-01" } },
				presets: [{ id: "incoming.responses" }],
			}),
		);
	});

	test("refines a query with a preset without adding an undefined filter", () => {
		const current = setRef("mailing.mail", {
			kind: "query",
			filter: { sender: { contains: "@customer.example" } },
		});
		expect(
			applySelectCommand(
				"mailing.mail",
				{
					scope: "current",
					mode: "refine",
					presets: [{ id: "incoming.responses" }],
				},
				current,
			),
		).toEqual(
			setRef("mailing.mail", {
				kind: "query",
				filter: { sender: { contains: "@customer.example" } },
				presets: [{ id: "incoming.responses" }],
			}),
		);
	});

	test("replaces parameters when refining the same preset", () => {
		const current = setRef("mailing.mail", {
			kind: "query",
			presets: [{ id: "incoming.campaign", params: { id: "old" } }],
		});
		expect(
			applySelectCommand(
				"mailing.mail",
				{
					scope: "current",
					mode: "refine",
					presets: [{ id: "incoming.campaign", params: { id: "new" } }],
				},
				current,
			),
		).toEqual(
			setRef("mailing.mail", {
				kind: "query",
				presets: [{ id: "incoming.campaign", params: { id: "new" } }],
			}),
		);
	});
});
