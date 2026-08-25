import { describe, expect, test } from "bun:test";
import { normalizeImportLeads, parseImportText } from "../src/import";

describe("parseImportText", () => {
	test("reads a JSON payload", () => {
		const { leads, format } = parseImportText(
			'{"leads":[{"company":"Acme","contacts":[{"type":"EMAIL","value":"a@acme.test"}]}]}',
		);
		expect(format).toBe("json");
		expect(leads[0].company).toBe("Acme");
	});

	test("reads a JSON array embedded in prose", () => {
		const { leads, format } = parseImportText(
			'Here you go:\n[{"company":"Acme"}]\nHope that helps.',
		);
		expect(format).toBe("json");
		expect(leads.length).toBe(1);
	});

	test("reads a csv table and maps the columns", () => {
		const { leads, format } = parseImportText(
			"Company,Email,Phone,Website,Role\nAcme,a@acme.test,+1 555 0100,acme.test,owner",
		);
		expect(format).toBe("delimited");
		expect(leads[0]).toMatchObject({ company: "Acme", description: "Acme" });
		expect(leads[0].contacts).toEqual([
			{ type: "EMAIL", value: "a@acme.test", role: "owner" },
			{ type: "PHONE", value: "+1 555 0100", role: "owner" },
			{ type: "DOMAIN", value: "acme.test", role: "owner" },
		]);
	});

	test("reads russian column names and semicolon separators", () => {
		const { leads } = parseImportText("Компания;Почта\nАкме;a@acme.test");
		expect(leads[0].company).toBe("Акме");
		expect(leads[0].contacts?.[0]).toMatchObject({ value: "a@acme.test" });
	});

	test("respects quoted cells containing the delimiter", () => {
		const { leads } = parseImportText(
			'Company,Description\nAcme,"milling, turning"',
		);
		expect(leads[0].description).toBe("milling, turning");
	});

	test("falls back to scanning loose lines", () => {
		const { leads, format } = parseImportText(
			"Acme Machining a@acme.test +1 555 0100",
		);
		expect(format).toBe("lines");
		expect(leads[0].contacts?.map((c) => c.type)).toEqual([
			"EMAIL",
			"PHONE",
			"DOMAIN",
		]);
	});

	test("empty input yields nothing", () => {
		expect(parseImportText("   ")).toEqual({ leads: [], format: "none" });
	});
});

describe("normalizeImportLeads", () => {
	test("fills the defaults and derives stable ids from the content", () => {
		const first = normalizeImportLeads({
			leads: [
				{ company: "Acme", contacts: [{ type: "email", value: "a@acme.test" }] },
			],
			defaultLang: "de",
			defaultType: "cnc",
			tags: ["batch-7"],
		});

		expect(first.items.length).toBe(1);
		const item = first.items[0];
		expect(item.lead).toMatchObject({ description: "Acme", lang: "de", type: "cnc" });
		expect(item.lead.id.startsWith("lead-")).toBe(true);
		expect(item.contacts[0]).toMatchObject({
			type: "EMAIL",
			value: "a@acme.test",
			leadId: item.lead.id,
		});
		expect(item.tags).toEqual(["batch-7"]);

		// same input -> same ids, so a re-import updates instead of duplicating
		const second = normalizeImportLeads({
			leads: [
				{ company: "Acme", contacts: [{ type: "email", value: "a@acme.test" }] },
			],
			defaultLang: "de",
			defaultType: "cnc",
		});
		expect(second.items[0].lead.id).toBe(item.lead.id);
		expect(second.items[0].contacts[0].id).toBe(item.contacts[0].id);
	});

	test("normalizes contact type aliases and defaults to email", () => {
		const { items } = normalizeImportLeads({
			leads: [
				{
					company: "Acme",
					contacts: [
						{ type: "website", value: "acme.test" },
						{ type: "url", value: "https://acme.test" },
						{ type: "linkedin", value: "in/acme" },
						{ type: "nonsense", value: "a@acme.test" },
					],
				},
			],
		});
		expect(items[0].contacts.map((c) => c.type)).toEqual([
			"DOMAIN",
			"DOMAIN",
			"LINKEDIN",
			"EMAIL",
		]);
	});

	test("drops rows with nothing to call them by, and empty contact values", () => {
		const { items, dropped } = normalizeImportLeads({
			leads: [
				{ contacts: [{ type: "EMAIL", value: "" }] },
				{ name: "Beta", contacts: [{ type: "EMAIL", value: " " }] },
			],
		});
		expect(dropped).toBe(1);
		expect(items.length).toBe(1);
		expect(items[0].lead.description).toBe("Beta");
		expect(items[0].contacts).toEqual([]);
	});

	test("an explicit id wins over the derived one", () => {
		const { items } = normalizeImportLeads({
			leads: [{ id: "lead-manual", company: "Acme" }],
		});
		expect(items[0].lead.id).toBe("lead-manual");
	});
});
