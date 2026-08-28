import { describe, expect, test } from "bun:test";
import { createFunctionCatalogTools } from "./function-catalog";

const parameters = {
	type: "object" as const,
	properties: { to: { type: "string" } },
};

describe("function catalog tools", () => {
	test("lists intent text and describes argument schemas", async () => {
		const tools = createFunctionCatalogTools({
			registry: {
				get: () => ({
					id: "mailing.send.form",
					brief: "Create email draft",
					description: "Open a form and prefill an email draft.",
					parameters,
				}),
			},
			context: {
				getHot: () => [],
				listCategories: () => [],
				listByCategory: () => [],
				search: () => [
					{
						id: "mailing.send.form",
						brief: "Create email draft",
						description: "Open a form and prefill an email draft.",
						parameters,
					},
				],
			},
			invoke: () => undefined,
		});

		const list = tools.find((tool) => tool.name === "listFunctions");
		const describe = tools.find((tool) => tool.name === "describeFunction");

		expect(await list?.execute({ query: "email" })).toEqual([
			expect.objectContaining({
				description: "Open a form and prefill an email draft.",
				parameters,
			}),
		]);
		expect(await describe?.execute({ id: "mailing.send.form" })).toEqual(
			expect.objectContaining({ parameters }),
		);
	});
});
