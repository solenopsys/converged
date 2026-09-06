import { describe, expect, test } from "bun:test";
import { formatSummaryValue } from "./StatisticSummary";

describe("formatSummaryValue", () => {
	test("uses the application locale for compact values", () => {
		const english = formatSummaryValue(12_205, "en");
		const russian = formatSummaryValue(12_205, "ru");

		expect(english).toContain("K");
		expect(english).not.toContain("тыс.");
		expect(russian).toContain("тыс.");
	});
});
