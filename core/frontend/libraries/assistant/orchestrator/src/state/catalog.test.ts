import { describe, expect, test } from "bun:test";
import { createConversationCatalog } from "./catalog";

describe("conversation catalog", () => {
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
});
