import { describe, expect, test } from "bun:test";
import { ObjectRegistry } from "./registry";
import { ObjectResolver } from "./resolver";
import { objectOf, objectRef, setOf, setRef } from "./types";

function fixture() {
	const registry = new ObjectRegistry();
	registry.register("mf-companies", {
		id: "mf-companies",
		types: [
			{
				id: "companies.company",
				label: "Company",
				pluralLabel: "Companies",
				categories: ["core.business", "core.selectable"],
			},
		],
		views: [
			{
				id: "companies.company",
				accepts: objectOf("companies.company"),
				component: () => null,
			},
			{
				id: "companies.companies",
				accepts: setOf("companies.company"),
				component: () => null,
			},
		],
		operations: [],
	});
	registry.register("mf-sales", {
		id: "mf-sales",
		types: [
			{
				id: "sales.outreach",
				label: "Outreach",
				categories: ["core.business", "core.creatable"],
			},
		],
		views: [],
		operations: [
			{
				id: "sales.outreach.create",
				operator: "create",
				target: "sales.outreach",
				label: "Create outreach",
				inputs: [{ name: "companies", accepts: setOf("companies.company") }],
				output: objectOf("sales.outreach"),
				invoke: () => objectRef("sales.outreach", "1"),
			},
		],
	});
	registry.register("mf-outreach-view", {
		id: "mf-outreach-view",
		types: [],
		views: [
			{
				id: "sales.outreach.detail",
				accepts: objectOf("sales.outreach"),
				component: () => null,
			},
		],
		operations: [],
	});
	return { registry, resolver: new ObjectResolver(registry) };
}

describe("ObjectResolver", () => {
	test("discovers selectable types for the select operator", () => {
		const { resolver } = fixture();
		expect(
			resolver.resolve("select").map((candidate) => candidate.targetType),
		).toEqual(["companies.company"]);
	});

	test("matches operations against typed references", () => {
		const { resolver } = fixture();
		const references = [
			setRef("companies.company", { kind: "ids", ids: ["a", "b"] }),
		];
		expect(
			resolver
				.resolve("create", { references })
				.map((candidate) => candidate.id),
		).toContain("sales.outreach.create");
		expect(
			resolver
				.resolve("create", { references })
				.find((candidate) => candidate.id === "sales.outreach.create")?.label,
		).toBe("Outreach");
		expect(
			resolver
				.resolve("create", {
					references: [objectRef("companies.company", "a")],
				})
				.map((candidate) => candidate.id),
		).not.toContain("sales.outreach.create");
	});

	test("offers open only for the object in the current context", () => {
		const { resolver } = fixture();
		expect(resolver.resolve("open")).toEqual([]);
		expect(
			resolver
				.resolve("open", {
					references: [objectRef("companies.company", "a")],
				})
				.map((candidate) => candidate.targetType),
		).toEqual(["companies.company"]);
	});

	test("resolves views by reference cardinality", () => {
		const { resolver } = fixture();
		expect(resolver.resolveView(objectRef("companies.company", "a"))?.id).toBe(
			"companies.company",
		);
		expect(
			resolver.resolveView(
				setRef("companies.company", { kind: "query", query: {} }),
			)?.id,
		).toBe("companies.companies");
	});
});
