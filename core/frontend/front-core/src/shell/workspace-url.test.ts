import { describe, expect, test } from "bun:test";
import {
	objectRef,
	registerSurface,
	setOf,
} from "front-core/object-runtime";
import {
	isConsolePath,
	referenceFromUrl,
	urlForReference,
} from "./workspace-url";

const View = () => null;

registerSurface({
	id: "sf-sales",
	label: "Sales",
	purpose: "Sales fixture",
	types: [{ id: "sales.lead", label: "Lead", pluralLabel: "Leads" }],
	views: [
		{
			id: "sales.lead.table",
			accepts: setOf("sales.lead"),
			component: View,
		},
	],
	operations: [],
});

describe("workspace URL", () => {
	test("reads references only from a console descendant", () => {
		expect(
			referenceFromUrl("https://example.test/console/sales/leads?filter=%7B%7D"),
		).toEqual({
			kind: "set",
			type: "sales.lead",
			selection: { kind: "query", filter: {} },
		});
		expect(referenceFromUrl("https://example.test/sales/leads")).toBeNull();
	});

	test("writes a projection route instead of a serialized reference", () => {
		const ref = objectRef("sales.lead", "42");
		const url = urlForReference(
			"https://example.test/console?language=ru",
			ref,
		);
		expect(url).toBe("/console/sales/leads/42");
		expect(referenceFromUrl(`https://example.test${url}`)).toEqual(ref);
	});

	test("recognizes every console descendant as the same SPA", () => {
		expect(isConsolePath("/console/sales/leads")).toBe(true);
		expect(isConsolePath("/console")).toBe(true);
		expect(isConsolePath("/sales/leads")).toBe(false);
	});
});
