import { beforeAll, describe, expect, test } from "bun:test";
import {
	catalogEntries,
	catalogEntry,
	invokeCatalogEntry,
	operatorCandidateEntries,
	operatorCatalogEntries,
	operatorCatalogEntry,
	operatorTargets,
	searchOperatorCatalog,
} from "./catalog";
import { objectRegistry } from "./registry";
import { Category, OPERATORS } from "./types";

beforeAll(() => {
	objectRegistry.declare("mf-companies", {
		id: "mf-companies",
		types: [
			{
				id: "companies.company",
				label: "Company",
				pluralLabel: "Companies",
				categories: [Category.Business, Category.Selectable],
			},
		],
		views: [
			{
				id: "companies.company.table",
				accepts: { kind: "set", type: "companies.company" },
			},
			{
				id: "companies.company.detail",
				accepts: { kind: "object", type: "companies.company" },
			},
		],
		operations: [],
	});
});

describe("operator catalog", () => {
	test("publishes only the fixed object vocabulary", () => {
		expect(operatorCatalogEntries().map((entry) => entry.operator)).toEqual([
			...OPERATORS,
		]);
		expect(operatorCatalogEntries().map((entry) => entry.id)).toEqual(
			OPERATORS.map((operator) => `core.${operator}`),
		);
	});

	test("an operator carries the types it can be pointed at", () => {
		expect(operatorTargets("show")).toContainEqual({
			id: "companies.company",
			label: "Company",
		});
		const targetType = operatorCatalogEntry("core.show")?.parameters.properties
			.targetType as { enum?: string[]; description: string };
		expect(targetType.enum).toContain("companies.company");
		expect(targetType.description).toContain("Company (companies.company)");
	});

	test("open enumerates types with an object view, not the empty resolution", () => {
		expect(operatorTargets("open")).toContainEqual({
			id: "companies.company",
			label: "Company",
		});
	});

	test("resolved candidates are catalog entries of their own", () => {
		const candidate = operatorCandidateEntries().find(
			(entry) => entry.id === "core.show:companies.company",
		);
		expect(candidate).toMatchObject({
			operator: "show",
			targetType: "companies.company",
			brief: "Show Company",
			priority: "primary",
		});
		expect(catalogEntry("core.show:companies.company")).toMatchObject({
			id: "core.show:companies.company",
		});
		expect(catalogEntries().length).toBeGreaterThan(
			operatorCatalogEntries().length,
		);
	});

	// The regression this file exists for: route and search rank words against
	// what the catalog says about itself, and "Show objects" says nothing about
	// companies.
	test("a domain word finds the operator applied to that type", () => {
		expect(
			searchOperatorCatalog("companies list").map((entry) => entry.id),
		).toContain("core.show:companies.company");
	});

	test("a query in another language still answers with the vocabulary", () => {
		expect(
			searchOperatorCatalog("открой список компаний").map((entry) => entry.id),
		).toEqual(OPERATORS.map((operator) => `core.${operator}`));
	});

	// A domain operation may hand back a live object; the chat serialises what it
	// gets, so the catalog answers with a fact about the call, not the value.
	test("an unserializable operation result does not travel to the transcript", async () => {
		const live: Record<string, unknown> = {};
		live.self = live;
		objectRegistry.register("mf-probe", {
			id: "mf-probe",
			types: [],
			views: [],
			operations: [
				{
					id: "probe.run",
					operator: "execute",
					target: "companies.company",
					label: "Run probe",
					access: "public",
					invoke: () => live,
				},
			],
		});

		expect(
			await invokeCatalogEntry("core.execute:companies.company", {}, "user"),
		).toEqual({
			ok: true,
			id: "core.execute:companies.company",
			note: "Result is not serializable and was omitted",
		});
	});
});
