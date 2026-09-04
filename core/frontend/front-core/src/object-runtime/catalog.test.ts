import { beforeAll, describe, expect, test } from "bun:test";
import { LocaleController, registerMicrofrontendLocales } from "../i18n";
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
	test("resolves user-facing operation labels from the active MF locale", () => {
		registerMicrofrontendLocales("mf-localized-probe", {
			en: {
				catalog: {
					operation: { label: "Record answer", description: "Save it" },
				},
			},
			ru: {
				catalog: {
					operation: { label: "Записать ответ", description: "Сохранить его" },
				},
			},
		});
		objectRegistry.register("mf-localized-probe", {
			id: "mf-localized-probe",
			types: [{ id: "probe.localized", label: "Localized probe" }],
			views: [],
			operations: [
				{
					id: "probe.localized.record",
					operator: "execute",
					target: "probe.localized",
					label: "Record answer",
					labelKey: "catalog.operation.label",
					description: "Save it",
					descriptionKey: "catalog.operation.description",
				},
			],
		});
		LocaleController.getInstance().setLocale("ru");

		const entry = catalogEntry("core.execute:probe.localized");
		expect(entry?.brief).toBe("Записать ответ");
		expect(entry?.description).toBe("Сохранить его");

		LocaleController.getInstance().setLocale("en");
	});

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

	test("select candidate without service filters still has a valid selection command", () => {
		objectRegistry.register("mf-unfiltered-probe", {
			id: "mf-unfiltered-probe",
			types: [
				{
					id: "probe.unfiltered",
					label: "Unfiltered probe",
					categories: [Category.Selectable],
				},
			],
			views: [
				{
					id: "probe.unfiltered.table",
					accepts: { kind: "set", type: "probe.unfiltered" },
					component: () => null,
				},
			],
			operations: [],
		});

		const candidate = catalogEntry("core.select:probe.unfiltered");
		expect(candidate?.parameters).toMatchObject({
			required: ["scope", "mode"],
			properties: {
				scope: { default: "new" },
				mode: { default: "replace" },
			},
		});
	});

	test("generic open cannot select an arbitrary operation without an object id", async () => {
		await expect(invokeCatalogEntry("core.open", {})).rejects.toThrow(
			"open requires targetType and object id",
		);
	});

	// The regression this file exists for: route and search rank words against
	// what the catalog says about itself, and "Show objects" says nothing about
	// companies.
	test("a domain word finds the operator applied to that type", () => {
		expect(
			searchOperatorCatalog("companies list").map((entry) => entry.id),
		).toContain("core.select:companies.company");
	});

	test("an incoming-mail hint finds the mail selection instead of generic open", () => {
		objectRegistry.register("mf-mail-search-probe", {
			id: "mf-mail-search-probe",
			types: [
				{
					id: "mail-search.incoming",
					label: "Mail",
					pluralLabel: "Mail",
					description: "Incoming email messages and inbox",
					categories: [Category.Communication, Category.Selectable],
				},
			],
			views: [
				{
					id: "mail-search.incoming.table",
					accepts: { kind: "set", type: "mail-search.incoming" },
					component: () => null,
				},
			],
			operations: [],
		});

		expect(searchOperatorCatalog("incoming letters open")[0]?.id).toBe(
			"core.select:mail-search.incoming",
		);
	});

	test("a query in another language falls back to concrete selections, never generic open", () => {
		const entries = searchOperatorCatalog("открой список компаний");
		expect(entries.map((entry) => entry.id)).toContain(
			"core.select:companies.company",
		);
		expect(entries.map((entry) => entry.id)).not.toContain("core.open");
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

	// The assistant knows no more about how deep an object goes than a click
	// does, so a create that names a composing screen opens it either way.
	// Without this the assistant sends the operation's empty `parameters` and
	// the service rejects a blank object.
	describe("a create that composes its object", () => {
		const Compose = () => null;
		let composed = 0;

		beforeAll(() => {
			objectRegistry.register("mf-compose-probe", {
				id: "mf-compose-probe",
				types: [
					{
						id: "probe.campaign",
						label: "Campaign",
						categories: [Category.Creatable],
					},
				],
				views: [
					{
						id: "probe.campaign.form",
						accepts: { kind: "object", type: "probe.campaign" },
						component: Compose,
					},
				],
				operations: [
					{
						id: "probe.campaign.create",
						operator: "create",
						target: "probe.campaign",
						label: "Create campaign",
						access: "public",
						view: "probe.campaign.form",
						inputs: [
							{
								name: "companies",
								accepts: { kind: "set", type: "companies.company" },
								required: false,
							},
						],
						invoke: () => {
							composed += 1;
							return { id: "made" };
						},
					},
				],
			});
		});

		test("opens the screen instead of creating a blank object", async () => {
			const presented: string[] = [];
			const stop = referencePresented.watch(({ ref, view }) =>
				presented.push(`${view.id}:${ref.kind === "object" ? ref.id : ""}`),
			);
			const before = composed;

			const result = await invokeCatalogEntry(
				"core.create:probe.campaign",
				{},
				"assistant",
			);

			stop();
			expect(presented).toEqual(["probe.campaign.form:new"]);
			expect(composed).toBe(before);
			expect(result).toMatchObject({
				ok: true,
				presented: { type: "probe.campaign", id: "new" },
			});
		});

		test("runs the operation when a reference already composes it", async () => {
			const presented: string[] = [];
			const stop = referencePresented.watch(({ view }) =>
				presented.push(view.id),
			);
			const before = composed;

			await invokeCatalogEntry(
				"core.create:probe.campaign",
				{
					references: [
						{
							kind: "set",
							type: "companies.company",
							selection: { kind: "ids", ids: ["1"] },
						},
					],
				},
				"assistant",
			);

			stop();
			expect(presented).toEqual([]);
			expect(composed).toBe(before + 1);
		});
	});
});
