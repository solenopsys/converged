import { describe, expect, test } from "bun:test";
import { createConversationCatalog } from "orchestrator";
import { publishCliCatalog, type CliSection } from "./assistant";

function sections(ran: string[] = []): Map<string, CliSection> {
	return new Map([
		[
			"cron",
			{
				commands: ["list"],
				catalog: [
					{ command: "list", description: "List all scheduled cron jobs" },
				],
				processCommand: async (command: string, param?: string) => {
					ran.push(`${command}:${param ?? ""}`);
					console.log("job-1");
				},
			},
		],
	]);
}

describe("assistant CLI integration", () => {
	test("publishes cron.list with an optional-only parameter schema", () => {
		const store = createConversationCatalog();
		publishCliCatalog(store, sections());

		expect(store.catalog.search("cron")).toMatchObject([{ id: "cron.list" }]);
		expect(store.catalog.meta("cron.list")).toMatchObject({
			id: "cron.list",
			parameters: {
				type: "object",
				properties: { param: { type: "string" } },
			},
		});
		expect(store.catalog.meta("cron.list")?.parameters?.required).toBeUndefined();
	});

	test("the printed output becomes the fact, so the answer has something to say", async () => {
		const ran: string[] = [];
		const store = createConversationCatalog();
		publishCliCatalog(store, sections(ran));

		const fact = await store.catalog.invoke("cron.list", { param: "today" });

		expect(ran).toEqual(["list:today"]);
		expect(fact).toMatchObject({ ok: true, ran: "cron.list", param: "today" });
		expect((fact as { output: string }).output).toContain("job-1");
	});
});
