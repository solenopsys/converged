import { describe, expect, test } from "bun:test";
import { createConversationCatalog } from "./catalog";

describe("conversation catalog", () => {
	test("passes loaded parameters through a frozen catalog", async () => {
		const catalog = createConversationCatalog();
		const parameters = {
			type: "object" as const,
			properties: { status: { type: "string" } },
		};
		catalog.sourceRegistered({
			id: "ui",
			group: "ui",
			load: async () => parameters,
			invoke: () => undefined,
		});
		catalog.functionsPublished({
			source: "ui",
			functions: [{ id: "companies.select", brief: "Select companies" }],
		});

		expect(await catalog.snapshot().load?.("companies.select")).toEqual(
			parameters,
		);
	});

	test("ranks a function by its full description, not just its brief", () => {
		const catalog = createConversationCatalog();
		catalog.sourceRegistered({
			id: "ui",
			group: "ui",
			invoke: () => undefined,
		});
		catalog.functionsPublished({
			source: "ui",
			functions: [
				{
					id: "mailing.send.form",
					brief: "Open form",
					description: "Create and prefill an email draft for a client.",
				},
				{
					id: "requests.model.update",
					brief: "Apply request model",
					description: "Update the currently opened request only.",
				},
			],
		});

		expect(catalog.catalog.search("email draft").map(({ id }) => id)).toEqual([
			"mailing.send.form",
		]);
	});

	test("marks every lower-scoring search result as approximate", () => {
		const catalog = createConversationCatalog();
		catalog.sourceRegistered({
			id: "ui",
			group: "ui",
			invoke: () => undefined,
		});
		catalog.functionsPublished({
			source: "ui",
			functions: [
				{
					id: "core.create:sales.audience",
					brief: "Lead audience",
					description: "Create a saved lead audience selection",
				},
				{
					id: "core.select:sales.lead",
					brief: "Select leads",
					description: "Create a temporary lead list",
				},
			],
		});

		expect(
			catalog.catalog
				.search("lead audience selection")
				.map(({ id, approximate }) => ({ id, approximate })),
		).toEqual([
			{ id: "core.create:sales.audience", approximate: undefined },
			{ id: "core.select:sales.lead", approximate: true },
		]);
	});

	test("keeps source-owned module descriptions out of function entries", () => {
		const catalog = createConversationCatalog();
		catalog.sourceRegistered({
			id: "ui",
			group: "ui",
			modules: () => [
				{
					id: "sf-sales",
					label: "Sales",
					count: 99,
					description: "Leads, contacts, audiences and campaigns",
				},
			],
			invoke: () => undefined,
		});
		catalog.functionsPublished({
			source: "ui",
			functions: [
				{
					id: "core.select:sales.lead",
					brief: "Select leads",
					module: "sf-sales",
					moduleLabel: "Sales",
				},
			],
		});

		expect(catalog.snapshot().listModules?.()).toEqual([
			{
				id: "sf-sales",
				label: "Sales",
				count: 1,
				description: "Leads, contacts, audiences and campaigns",
			},
		]);
		expect(catalog.snapshot().byModule?.("sf-sales")).toMatchObject([
			{
				id: "core.select:sales.lead",
				brief: "Select leads",
				module: "sf-sales",
			},
		]);
	});
});
