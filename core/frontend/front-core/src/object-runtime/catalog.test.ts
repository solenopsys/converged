import { beforeAll, describe, expect, test } from "bun:test";
import { setActiveSelectionResolver } from "../select/runtime";
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
import { referencePresented } from "./runtime";
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
				selection: {
					filters: [
						{
							id: "status",
							label: "Status",
							valueType: "string",
							operators: ["eq", "in"],
							options: [{ id: "active", label: "Active" }],
						},
					],
				},
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

	test("show does not compete with select for selectable types", () => {
		expect(operatorTargets("show")).not.toContainEqual({
			id: "companies.company",
			label: "Company",
		});
		const targetType = operatorCatalogEntry("core.show")?.parameters.properties
			.targetType as { enum?: string[]; description: string };
		expect(targetType.enum ?? []).not.toContain("companies.company");
	});

	test("open enumerates types with an object view, not the empty resolution", () => {
		expect(operatorTargets("open")).toContainEqual({
			id: "companies.company",
			label: "Company",
		});
	});

	test("resolved candidates are catalog entries of their own", () => {
		expect(
			operatorCandidateEntries().find(
				(entry) => entry.id === "core.show:companies.company",
			),
		).toBeUndefined();
		expect(catalogEntry("core.show:companies.company")).toBeUndefined();
		expect(catalogEntries().length).toBeGreaterThan(
			operatorCatalogEntries().length,
		);
	});

	test("select candidate exposes its type filter schema to the assistant", () => {
		const candidate = operatorCandidateEntries().find(
			(entry) => entry.id === "core.select:companies.company",
		);
		expect(candidate?.parameters.properties).toMatchObject({
			filter: {
				properties: {
					status: { properties: { eq: { enum: ["active"] } } },
				},
			},
		});
	});

	// The regression this file exists for: route and search rank words against
	// what the catalog says about itself, and "Show objects" says nothing about
	// companies.
	test("a domain word finds the operator applied to that type", () => {
		expect(
			searchOperatorCatalog("companies list").map((entry) => entry.id),
		).toContain("core.select:companies.company");
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

	test("select returns a set reference and compact statistics", async () => {
		objectRegistry.register("mf-select-probe", {
			id: "mf-select-probe",
			types: [
				{
					id: "probe.item",
					label: "Probe",
					categories: [Category.Selectable],
					selection: {
						filters: [
							{
								id: "status",
								label: "Status",
								valueType: "string",
								operators: ["eq"],
							},
						],
						inspect: async () => ({ totalCount: 3 }),
					},
				},
			],
			views: [
				{
					id: "probe.item.table",
					accepts: { kind: "set", type: "probe.item" },
					component: () => null,
				},
			],
			operations: [],
		});
		setActiveSelectionResolver(undefined);
		expect(
			await invokeCatalogEntry("core.select:probe.item", {
				scope: "new",
				mode: "replace",
				filter: { status: { eq: "ready" } },
			}),
		).toEqual({
			selection: {
				kind: "set",
				type: "probe.item",
				selection: { kind: "query", filter: { status: { eq: "ready" } } },
			},
			stats: { totalCount: 3 },
		});
	});

	test("assistant selection marks its mounted set as assistant-owned", async () => {
		const sources: Array<string | undefined> = [];
		const stop = referencePresented.watch(({ ref, options }) => {
			if (ref.type === "probe.item") sources.push(options.source);
		});

		await invokeCatalogEntry(
			"core.select:probe.item",
			{ scope: "new", mode: "replace", filter: { status: { eq: "ready" } } },
			"assistant",
		);

		stop();
		expect(sources.at(-1)).toBe("assistant");
	});

	test("refines the set captured at the start of an assistant turn", async () => {
		const current = {
			ref: {
				kind: "set" as const,
				type: "probe.item",
				selection: {
					kind: "query" as const,
					filter: { status: { eq: "ready" } },
				},
			},
			tabKey: "set:probe.item:ready",
		};
		setActiveSelectionResolver(undefined);

		const result = await invokeCatalogEntry(
			"core.select:probe.item",
			{
				scope: "current",
				mode: "refine",
				filter: { status: { eq: "pending" } },
			},
			"assistant",
			current,
		);

		expect(result).toMatchObject({
			selection: {
				kind: "set",
				type: "probe.item",
				selection: {
					kind: "query",
					filter: {
						AND: [{ status: { eq: "ready" } }, { status: { eq: "pending" } }],
					},
				},
			},
		});
	});
});
