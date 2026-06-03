import { createHash } from "node:crypto";
import { Workflow } from "@rt/engines/dag";
import { unzipSync } from "fflate";
import { AgentStreamEventType, createAgentServiceClient } from "g-agent";
import {
	type Contact,
	ContactType,
	createSalesServiceClient,
	type Lead,
} from "g-sales";
import { createStorageClients, readFileFromStorage } from "./lib/file-storage";

type SalesImportContact = {
	type?: string;
	value?: string;
	role?: string;
	description?: string;
};

type SalesImportLead = {
	id?: string;
	company?: string;
	name?: string;
	description?: string;
	lang?: string;
	type?: string;
	catalogId?: string;
	contacts?: SalesImportContact[];
	tags?: string[];
};

type SalesImportInput = {
	fileIds?: string[];
	rawText?: string;
	defaultLang?: string;
	defaultType?: string;
	tags?: string[];
	useAgent?: boolean;
	agentModel?: string;
	servicesBaseUrl?: string;
	dryRun?: boolean;
};

type SalesImportResult = {
	status: "imported" | "dry-run" | "empty";
	parsed: number;
	leadsCreated: number;
	leadsSkipped: number;
	contactsCreated: number;
	contactsSkipped: number;
	errors: { id?: string; stage: string; message: string }[];
	items: {
		leadId: string;
		description: string;
		contacts: { id: string; type: string; value: string }[];
	}[];
};

const decoder = new TextDecoder("utf-8", { fatal: false });

function hashId(prefix: string, value: string): string {
	const digest = createHash("sha256").update(value).digest("hex").slice(0, 20);
	return `${prefix}-${digest}`;
}

function cleanText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function xmlDecode(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

function extractXmlText(xml: string): string[] {
	return Array.from(xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (match) =>
		xmlDecode(match[1]?.replace(/<[^>]+>/g, "") ?? "").trim(),
	);
}

function extractXlsxText(bytes: Uint8Array): string {
	const files = unzipSync(bytes);
	const sharedStrings = files["xl/sharedStrings.xml"]
		? extractXmlText(decoder.decode(files["xl/sharedStrings.xml"]))
		: [];
	const sheets = Object.entries(files)
		.filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
		.sort(([left], [right]) => left.localeCompare(right));
	const lines: string[] = [];

	for (const [, data] of sheets) {
		const xml = decoder.decode(data);
		for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
			const rowXml = rowMatch[1] ?? "";
			const cells: string[] = [];
			for (const cellMatch of rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
				const attrs = cellMatch[1] ?? "";
				const body = cellMatch[2] ?? "";
				const type = attrs.match(/\bt="([^"]+)"/)?.[1];
				const rawValue =
					body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ??
					body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ??
					"";
				const value =
					type === "s"
						? (sharedStrings[Number(rawValue)] ?? "")
						: xmlDecode(rawValue);
				cells.push(value.trim());
			}
			if (cells.some(Boolean)) lines.push(cells.join("\t"));
		}
	}

	return lines.join("\n");
}

function extractSvgText(bytes: Uint8Array): string {
	const raw = decoder.decode(bytes);
	const textNodes = extractXmlText(raw);
	const titleNodes = Array.from(
		raw.matchAll(/<(title|desc)[^>]*>([\s\S]*?)<\/\1>/g),
		(match) => xmlDecode(match[2]?.replace(/<[^>]+>/g, "") ?? "").trim(),
	);
	return [...titleNodes, ...textNodes, raw.replace(/<[^>]+>/g, " ")]
		.filter(Boolean)
		.join("\n");
}

function extractTextFromBytes(name: string, bytes: Uint8Array): string {
	const lower = name.toLowerCase();
	if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
		return extractXlsxText(bytes);
	}
	if (lower.endsWith(".svg")) {
		return extractSvgText(bytes);
	}
	return decoder.decode(bytes);
}

function tryParseJsonLeads(text: string): SalesImportLead[] {
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
			if (Array.isArray(parsed)) return parsed as SalesImportLead[];
			if (Array.isArray(parsed?.leads))
				return parsed.leads as SalesImportLead[];
		} catch {
			// Continue with looser parsers.
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

function parseDelimitedLeads(text: string): SalesImportLead[] {
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

	return lines.slice(1).flatMap((line): SalesImportLead[] => {
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

		const contacts: SalesImportContact[] = [
			email ? { type: ContactType.EMAIL, value: email, role } : null,
			phone ? { type: ContactType.PHONE, value: phone, role } : null,
			domain ? { type: ContactType.DOMAIN, value: domain, role } : null,
		].filter((contact): contact is SalesImportContact => Boolean(contact));

		if (!description && contacts.length === 0) return [];
		return [{ company, description, lang, type, contacts, tags }];
	});
}

function parseLooseLineLeads(text: string): SalesImportLead[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.flatMap((line): SalesImportLead[] => {
			const email =
				line.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
			const phone = line.match(/(?:\+?\d[\d\s().-]{6,}\d)/)?.[0]?.trim() ?? "";
			const domain =
				line.match(/https?:\/\/[^\s,;]+/i)?.[0] ??
				line.match(/\b[a-z0-9.-]+\.[a-z]{2,}\b/i)?.[0] ??
				"";
			const contacts: SalesImportContact[] = [
				email ? { type: ContactType.EMAIL, value: email } : null,
				phone ? { type: ContactType.PHONE, value: phone } : null,
				domain ? { type: ContactType.DOMAIN, value: domain } : null,
			].filter((contact): contact is SalesImportContact => Boolean(contact));

			return contacts.length > 0 || line.length > 2
				? [{ description: line, contacts }]
				: [];
		});
}

async function analyzeWithAgent(
	text: string,
	params: SalesImportInput,
): Promise<SalesImportLead[]> {
	const agent = createAgentServiceClient({ baseUrl: params.servicesBaseUrl });
	const session = await agent.createSession(params.agentModel);
	const prompt = [
		"Extract a sales/customer outreach list from the input.",
		"Return only valid JSON with this shape:",
		'{"leads":[{"company":"","description":"","lang":"en","type":"reviews","contacts":[{"type":"EMAIL","value":"","role":"","description":""}],"tags":[""]}]}',
		"Use contact type EMAIL, PHONE, DOMAIN, or LINKEDIN. Do not invent contacts.",
		"",
		text.slice(0, 120000),
	].join("\n");

	let output = "";
	for await (const event of agent.sendMessage(session.id, prompt)) {
		if (event.type === AgentStreamEventType.TEXT_DELTA) {
			output += event.content;
		}
	}

	return tryParseJsonLeads(output);
}

function normalizeContactType(value: unknown): ContactType {
	const normalized = cleanText(value).toUpperCase();
	if (normalized === ContactType.PHONE) return ContactType.PHONE;
	if (normalized === ContactType.LINKEDIN) return ContactType.LINKEDIN;
	if (
		normalized === ContactType.DOMAIN ||
		normalized === "WEBSITE" ||
		normalized === "URL"
	) {
		return ContactType.DOMAIN;
	}
	return ContactType.EMAIL;
}

function normalizeLeads(
	rawLeads: SalesImportLead[],
	params: SalesImportInput,
): { lead: Lead; contacts: Contact[]; tags: string[] }[] {
	const defaultLang = params.defaultLang ?? "en";
	const defaultType = params.defaultType ?? "reviews";
	const defaultTags = params.tags ?? [];

	return rawLeads.flatMap((item) => {
		const description =
			cleanText(item.description) ||
			cleanText(item.company) ||
			cleanText(item.name);
		if (!description) return [];

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
		const contacts = (item.contacts ?? [])
			.map((contact): Contact | null => {
				const value = cleanText(contact.value);
				if (!value) return null;
				const type = normalizeContactType(contact.type);
				return {
					id: hashId("contact", `${leadId}:${type}:${value}`),
					leadId,
					type,
					value,
					role: cleanText(contact.role),
					description: cleanText(contact.description),
					createdAt: new Date(),
				};
			})
			.filter((contact): contact is Contact => Boolean(contact));
		const tags = [...defaultTags, ...(item.tags ?? [])]
			.map((tag) => tag.trim())
			.filter(Boolean);

		return [{ lead, contacts, tags }];
	});
}

function isConflict(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /already exists|conflict|409|SQLITE_CONSTRAINT/i.test(message);
}

export class SalesImportWorkflow extends Workflow {
	async execute(params: SalesImportInput = {}): Promise<void> {
		const texts: string[] = [];
		const clients = createStorageClients(params.servicesBaseUrl);

		for (const fileId of params.fileIds ?? []) {
			const stored = await this.invoke(`read-file-${fileId}`, () =>
				readFileFromStorage(fileId, clients),
			);
			texts.push(extractTextFromBytes(stored.metadata.name, stored.bytes));
		}

		if (params.rawText?.trim()) {
			texts.push(params.rawText);
		}

		const sourceText = texts.join("\n\n").trim();
		if (!sourceText) {
			const empty: SalesImportResult = {
				status: "empty",
				parsed: 0,
				leadsCreated: 0,
				leadsSkipped: 0,
				contactsCreated: 0,
				contactsSkipped: 0,
				errors: [],
				items: [],
			};
			this.setVar("sales-import:last-result", empty);
			await this.invoke("final-result", async () => empty);
			return;
		}

		let rawLeads: SalesImportLead[] = [];
		if (params.useAgent ?? true) {
			try {
				rawLeads = await this.invoke("agent-extract-leads", () =>
					analyzeWithAgent(sourceText, params),
				);
			} catch (_error) {
				rawLeads = [];
			}
		}
		if (rawLeads.length === 0) rawLeads = tryParseJsonLeads(sourceText);
		if (rawLeads.length === 0) rawLeads = parseDelimitedLeads(sourceText);
		if (rawLeads.length === 0) rawLeads = parseLooseLineLeads(sourceText);

		const normalized = normalizeLeads(rawLeads, params);
		const result: SalesImportResult = {
			status: params.dryRun ? "dry-run" : "imported",
			parsed: normalized.length,
			leadsCreated: 0,
			leadsSkipped: 0,
			contactsCreated: 0,
			contactsSkipped: 0,
			errors: [],
			items: normalized.map(({ lead, contacts }) => ({
				leadId: lead.id,
				description: lead.description,
				contacts: contacts.map((contact) => ({
					id: contact.id,
					type: contact.type,
					value: contact.value,
				})),
			})),
		};

		if (params.dryRun) {
			this.setVar("sales-import:last-result", result);
			await this.invoke("final-result", async () => result);
			return;
		}

		const sales = createSalesServiceClient({ baseUrl: params.servicesBaseUrl });
		for (const item of normalized) {
			await this.invoke(`save-lead-${item.lead.id}`, async () => {
				try {
					await sales.addLead(item.lead);
					result.leadsCreated++;
				} catch (error) {
					if (!isConflict(error)) {
						result.errors.push({
							id: item.lead.id,
							stage: "lead",
							message: error instanceof Error ? error.message : String(error),
						});
						return;
					}
					result.leadsSkipped++;
				}

				for (const contact of item.contacts) {
					try {
						await sales.addContact(contact);
						result.contactsCreated++;
					} catch (error) {
						if (isConflict(error)) {
							result.contactsSkipped++;
						} else {
							result.errors.push({
								id: contact.id,
								stage: "contact",
								message: error instanceof Error ? error.message : String(error),
							});
						}
					}
				}

				for (const tag of item.tags) {
					try {
						await sales.assignLeadTag(item.lead.id, tag);
					} catch (error) {
						if (!isConflict(error)) {
							result.errors.push({
								id: item.lead.id,
								stage: "tag",
								message: error instanceof Error ? error.message : String(error),
							});
						}
					}
				}
			});
		}

		this.setVar("sales-import:last-result", result);
		await this.invoke("final-result", async () => result);
	}
}

export const WORKFLOWS = [{ name: "sales-import", ctor: SalesImportWorkflow }];
