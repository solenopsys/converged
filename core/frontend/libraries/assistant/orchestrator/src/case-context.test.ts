import { describe, expect, test } from "bun:test";
import { buildCaseContext, caseLanguage } from "./case-context";

describe("CASE context builder", () => {
	test("normalizes browser locales to CASE languages", () => {
		expect(caseLanguage("ru-RU")).toBe("ru");
		expect(caseLanguage("pt_BR")).toBe("pt");
		expect(caseLanguage("ja-JP")).toBeUndefined();
	});

	test("keeps English plus the active language for user-visible commands", () => {
		const context = buildCaseContext("workspace:ru:v1", "ru-RU", [
			{
				id: "mailing.incoming.show",
				exposure: "user",
				root: { surface: "sf-mailing", baseType: "mailing" },
				examples: {
					en: ["show incoming mail"],
					ru: ["покажи входящие письма", " покажи входящие письма "],
				},
			},
			{
				id: "mailing.incoming.fetch",
				exposure: "llm",
				root: { surface: "sf-mailing", baseType: "mailing" },
				examples: { ru: ["получи письма"] },
			},
			{
				id: "sales.stats.show",
				exposure: "user",
				root: { surface: "sf-sales", baseType: "sales" },
				examples: { ru: ["покажи статистику продаж"] },
			},
		]);

		expect(context).toEqual({
			key: "workspace:ru:v1",
			sections: [
				{
					id: "sf-mailing:mailing",
					commands: [
						{
							id: "mailing.incoming.show",
							examples: {
								en: ["show incoming mail"],
								ru: ["покажи входящие письма"],
							},
						},
					],
				},
				{
					id: "sf-sales:sales",
					commands: [
						{
							id: "sales.stats.show",
							examples: { ru: ["покажи статистику продаж"] },
						},
					],
				},
			],
		});
	});
});
