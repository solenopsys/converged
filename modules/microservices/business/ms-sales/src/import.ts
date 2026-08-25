// Lead-list parsing and normalization for wf-sales-import. This was the
// extract/normalize half of the old `nodes/sales-import.ts`: regex scanning
// over a whole uploaded file and sha256-derived ids. Neither can run in the VM
// (100 ms JS deadline, no node:crypto), so both live here, in the service that
// owns leads and contacts.

import { createHash } from "node:crypto";
import type {
	Contact,
	ImportContact,
	ImportItem,
	ImportLead,
	ImportSourceFormat,
	Lead,
} from "../types";

const CONTACT_EMAIL = "EMAIL";
const CONTACT_PHONE = "PHONE";
const CONTACT_DOMAIN = "DOMAIN";
const CONTACT_LINKEDIN = "LINKEDIN";

function cleanText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

/** Stable id derived from the row's content: re-importing the same file must
 *  hit the same lead, not create a duplicate. */
function hashId(prefix: string, value: string): string {
	return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 20)}`;
}

// ---- parsers ---------------------------------------------------------------

/** A JSON payload, either a bare array or `{ leads: [...] }`. Also tolerates
 *  an array embedded in surrounding prose (an LLM answer with a preamble). */
export function tryParseJsonLeads(text: string): ImportLead[] {
	const trimmed = text.trim();
	if (!trimmed) return [];

	const candidates = [trimmed];
	const arrayStart = trimmed.indexOf("[");
	const arrayEnd = trimmed.lastIndexOf("]");
	if (arrayStart >= 0 && arrayEnd > arrayStart) {
		candidates.push(trimmed.slice(arrayStart, arrayEnd + 1));
	}

	for (const candidate of candidates) {
		try {
			const parsed = JSON.parse(candidate);
			if (Array.isArray(parsed)) return parsed as ImportLead[];
			if (Array.isArray(parsed?.leads)) return parsed.leads as ImportLead[];
		} catch {
			// not this candidate — fall through to the looser parsers
		}
	}

	return [];
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
	const cells: string[] = [];
	let current = "";
	let quoted = false;
	for (let index = 0; index < line.length; index++) {
		const char = line[index];
		const next = line[index + 1];
		if (char === '"' && quoted && next === '"') {
			current += '"';
			index++;
			continue;
		}
		if (char === '"') {
			quoted = !quoted;
			continue;
		}
		if (char === delimiter && !quoted) {
			cells.push(current.trim());
			current = "";
			continue;
		}
		current += char;
	}
	cells.push(current.trim());
	return cells;
}

/** Whichever of tab/semicolon/comma splits the header into the most cells. */
function pickDelimiter(line: string): string {
	const candidates = ["\t", ";", ","];
	return (
		candidates
			.map((delimiter) => ({
				delimiter,
				count: splitDelimitedLine(line, delimiter).length,
			}))
			.sort((left, right) => right.count - left.count)[0]?.delimiter ?? ","
	);
}

function normalizeHeader(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9а-яё]+/gi, "_");
}

function pickField(row: Record<string, string>, names: string[]): string {
	for (const name of names) {
		const value = cleanText(row[name]);
		if (value) return value;
	}
	return "";
}

/** A csv/tsv/xlsx table with a header row. Column names are matched loosely,
 *  in English and Russian, because these files come from customers. */
export function parseDelimitedLeads(text: string): ImportLead[] {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length < 2) return [];

	const delimiter = pickDelimiter(lines[0] ?? "");
	const headers = splitDelimitedLine(lines[0] ?? "", delimiter).map(
		normalizeHeader,
	);
	if (headers.length < 2) return [];

	return lines.slice(1).flatMap((line): ImportLead[] => {
		const values = splitDelimitedLine(line, delimiter);
		const row: Record<string, string> = {};
		headers.forEach((header, index) => {
			row[header] = values[index] ?? "";
		});

		const company = pickField(row, [
			"company",
			"name",
			"client",
			"customer",
			"компания",
			"клиент",
			"имя",
		]);
		const description =
			pickField(row, [
				"description",
				"notes",
				"comment",
				"описание",
				"заметка",
				"комментарий",
			]) ||
			company ||
			line;
		const email = pickField(row, ["email", "e_mail", "mail", "почта"]);
		const phone = pickField(row, ["phone", "tel", "telephone", "телефон"]);
		const domain = pickField(row, [
			"domain",
			"website",
			"site",
			"url",
			"сайт",
			"домен",
		]);
		const lang = pickField(row, ["lang", "language", "locale", "язык"]);
		const type = pickField(row, ["type", "segment", "тип"]);
		const role = pickField(row, [
			"role",
			"position",
			"title",
			"роль",
			"должность",
		]);
		const tags = pickField(row, ["tags", "tag", "теги"])
			.split(/[,\s]+/)
			.map((tag) => tag.trim())
			.filter(Boolean);

		const contacts: ImportContact[] = [];
		if (email) contacts.push({ type: CONTACT_EMAIL, value: email, role });
		if (phone) contacts.push({ type: CONTACT_PHONE, value: phone, role });
		if (domain) contacts.push({ type: CONTACT_DOMAIN, value: domain, role });

		if (!description && contacts.length === 0) return [];
		return [{ company, description, lang, type, contacts, tags }];
	});
}

/** Last resort: scan each line for an email, a phone and a domain. */
export function parseLooseLineLeads(text: string): ImportLead[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.flatMap((line): ImportLead[] => {
			const email =
				line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
			const phone = line.match(/(?:\+?\d[\d\s().-]{6,}\d)/)?.[0]?.trim() ?? "";
			const domain =
				line.match(/https?:\/\/[^\s,;]+/i)?.[0] ??
				line.match(/\b[a-z0-9.-]+\.[a-z]{2,}\b/i)?.[0] ??
				"";

			const contacts: ImportContact[] = [];
			if (email) contacts.push({ type: CONTACT_EMAIL, value: email });
			if (phone) contacts.push({ type: CONTACT_PHONE, value: phone });
			if (domain) contacts.push({ type: CONTACT_DOMAIN, value: domain });

			return contacts.length > 0 || line.length > 2
				? [{ description: line, contacts }]
				: [];
		});
}

/** JSON first, then a delimited table, then loose lines — the first parser that
 *  finds anything wins. */
export function parseImportText(text: string): {
	leads: ImportLead[];
	format: ImportSourceFormat;
} {
	let leads = tryParseJsonLeads(text);
	if (leads.length > 0) return { leads, format: "json" };

	leads = parseDelimitedLeads(text);
	if (leads.length > 0) return { leads, format: "delimited" };

	leads = parseLooseLineLeads(text);
	if (leads.length > 0) return { leads, format: "lines" };

	return { leads: [], format: "none" };
}

// ---- normalization ---------------------------------------------------------

function normalizeContactType(value: unknown): string {
	const normalized = cleanText(value).toUpperCase();
	if (normalized === CONTACT_PHONE) return CONTACT_PHONE;
	if (normalized === CONTACT_LINKEDIN) return CONTACT_LINKEDIN;
	if (
		normalized === CONTACT_DOMAIN ||
		normalized === "WEBSITE" ||
		normalized === "URL"
	) {
		return CONTACT_DOMAIN;
	}
	return CONTACT_EMAIL;
}

/** Raw rows -> the exact Lead/Contact rows the workflow will insert. A row with
 *  nothing to call it by is dropped. */
export function normalizeImportLeads(input: {
	leads: ImportLead[];
	defaultLang?: string;
	defaultType?: string;
	tags?: string[];
}): { items: ImportItem[]; dropped: number } {
	const defaultLang = input.defaultLang ?? "en";
	const defaultType = input.defaultType ?? "reviews";
	const defaultTags = input.tags ?? [];
	const items: ImportItem[] = [];
	let dropped = 0;

	for (const item of input.leads) {
		const description =
			cleanText(item.description) ||
			cleanText(item.company) ||
			cleanText(item.name);
		if (!description) {
			dropped++;
			continue;
		}

		const leadId =
			cleanText(item.id) ||
			hashId("lead", `${description}:${JSON.stringify(item.contacts ?? [])}`);
		const lead: Lead = {
			id: leadId,
			description,
			lang: cleanText(item.lang) || defaultLang,
			type: cleanText(item.type) || defaultType,
			catalogId: cleanText(item.catalogId),
			createdAt: new Date(),
		};

		const contacts: Contact[] = [];
		for (const contact of item.contacts ?? []) {
			const value = cleanText(contact.value);
			if (!value) continue;
			const type = normalizeContactType(contact.type);
			contacts.push({
				id: hashId("contact", `${leadId}:${type}:${value}`),
				leadId,
				type: type as Contact["type"],
				value,
				role: cleanText(contact.role),
				description: cleanText(contact.description),
				createdAt: new Date(),
			});
		}

		const tags = [...defaultTags, ...(item.tags ?? [])]
			.map((tag) => tag.trim())
			.filter(Boolean);

		items.push({ lead, contacts, tags });
	}

	return { items, dropped };
}
