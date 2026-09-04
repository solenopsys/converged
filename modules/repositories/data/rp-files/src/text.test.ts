import { describe, expect, test } from "bun:test";
import { zipSync } from "fflate";
import { extractTextFromBytes } from "./text";

const encode = (s: string) => new TextEncoder().encode(s);

describe("extractTextFromBytes", () => {
	test("decodes plain text and csv as UTF-8", () => {
		expect(extractTextFromBytes("leads.csv", encode("a,b\n1,2"))).toBe("a,b\n1,2");
		expect(extractTextFromBytes("notes.txt", encode("привет"))).toBe("привет");
	});

	test("reads xlsx sheets into tab-separated rows, resolving shared strings", () => {
		const xlsx = zipSync({
			"xl/sharedStrings.xml": encode(
				'<sst><si><t>Company</t></si><si><t>Acme &amp; Co</t></si></sst>',
			),
			"xl/worksheets/sheet1.xml": encode(
				'<worksheet><sheetData>' +
					'<row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row>' +
					'<row><c><v>42</v></c></row>' +
					"<row></row>" +
					"</sheetData></worksheet>",
			),
		});

		expect(extractTextFromBytes("leads.xlsx", xlsx)).toBe(
			"Company\tAcme & Co\n42",
		);
	});

	test("orders multiple sheets by name", () => {
		const cell = (v: string) =>
			`<worksheet><sheetData><row><c><v>${v}</v></c></row></sheetData></worksheet>`;
		const xlsx = zipSync({
			"xl/worksheets/sheet2.xml": encode(cell("second")),
			"xl/worksheets/sheet1.xml": encode(cell("first")),
		});

		expect(extractTextFromBytes("book.xlsm", xlsx)).toBe("first\nsecond");
	});

	test("pulls titles and text nodes out of an svg", () => {
		const svg =
			'<svg><title>Acme</title><text><t>owner@acme.test</t></text></svg>';
		const out = extractTextFromBytes("card.svg", encode(svg));
		expect(out).toContain("Acme");
		expect(out).toContain("owner@acme.test");
	});
});
