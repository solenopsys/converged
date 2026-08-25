// wf-sales-import — flow only. Turns uploaded lead lists (xlsx / csv / json /
// free text) and/or pasted text into sales leads with their contacts. The LLM
// gets first pass at the text; whatever it fails to produce falls back to the
// deterministic parsers in ms-sales. Every insert is its own attempt, so a row
// that clashes with an existing one is counted as skipped instead of sinking
// the import.
//
// Old nodes → now: load-text-sources = files.materialize + files.extractText
// (unzipping a spreadsheet and running XML regexes over it must not happen in
// the VM); extract-leads = rt.llm here, with sales.parseImportLeads as the
// fallback — the provider hub is the only LLM in the new runtime, and the
// regex parsers are too heavy for it; normalize-leads = sales.normalizeImportLeads
// (the ids are sha256 and QuickJS has no node:crypto); persist = the addLead /
// addContact / assignLeadTag loop, which is flow and stays here.

import "dag-core/env";

import { createFilesServiceRtClient } from "g-files/rt";
import { createSalesServiceRtClient } from "g-sales/rt";

const files = createFilesServiceRtClient();
const sales = createSalesServiceRtClient();

const EXTRACT_PROMPT = [
	"Extract a sales/customer outreach list from the input.",
	"Return only valid JSON with this shape:",
	'{"leads":[{"company":"","description":"","lang":"en","type":"reviews","contacts":[{"type":"EMAIL","value":"","role":"","description":""}],"tags":[""]}]}',
	"Use contact type EMAIL, PHONE, DOMAIN, or LINKEDIN. Do not invent contacts.",
].join("\n");

const DEFAULTS = {
	defaultLang: "en",
	defaultType: "reviews",
	/** how much text of one file to read; the old node capped the prompt at this */
	maxCharsPerFile: 120000,
	maxTokens: 8192,
	dryRun: false,
};

type Input = Partial<typeof DEFAULTS> & {
	fileIds?: string[];
	rawText?: string;
	tags?: string[];
	owner?: string;
	/** provider+model enable the LLM pass; without them only the parsers run */
	provider?: string;
	model?: string;
};

type StepError = { id?: string; stage: string; message: string };

/** The model is asked for bare JSON but often wraps it in a fence. */
function parseLeadsJson(body: string): Record<string, unknown>[] {
	const cleaned = body
		.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1")
		.trim();
	const parsed = JSON.parse(cleaned) as any;
	if (Array.isArray(parsed)) return parsed;
	if (Array.isArray(parsed?.leads)) return parsed.leads;
	return [];
}

/** ms-sales answers a duplicate row with a conflict; that is a skip, not a
 *  failure — re-importing the same file must be harmless. */
function isConflict(message: string): boolean {
	return /already exists|conflict|409|constraint/i.test(message);
}

rt.workflow = (input: Input) => {
	const o = { ...DEFAULTS, ...(input ?? {}) };
	const fileIds = input?.fileIds ?? [];
	const rawText = (input?.rawText ?? "").trim();
	if (fileIds.length === 0 && !rawText)
		throw new Error("sales-import requires params.fileIds or params.rawText");

	const errors: StepError[] = [];

	// ---- 1. text sources ---------------------------------------------------
	const texts: string[] = [];
	const sources: { fileId: string; name: string; chars: number; truncated: boolean }[] = [];
	for (const fileId of fileIds) {
		const read = rt.attempt(`read-file:${fileId}`, () => {
			const staged = files.materialize(fileId);
			const extracted = files.extractText({
				ref: staged.ref,
				name: staged.metadata.name,
				maxChars: o.maxCharsPerFile,
			});
			return { name: staged.metadata.name, ...extracted };
		});
		if (!read.ok) {
			errors.push({ id: fileId, stage: "load", message: read.error });
			continue;
		}
		sources.push({
			fileId,
			name: read.value.name,
			chars: read.value.chars,
			truncated: read.value.truncated,
		});
		if (read.value.text.trim()) texts.push(read.value.text);
	}
	if (rawText) texts.push(rawText);

	const sourceText = texts.join("\n\n").trim();
	if (!sourceText) {
		const empty = {
			status: "empty",
			parsed: 0,
			leadsCreated: 0,
			leadsSkipped: 0,
			contactsCreated: 0,
			contactsSkipped: 0,
			sources,
			errors,
			items: [] as Record<string, unknown>[],
		};
		rt.set("sales-import:last-result", empty);
		rt.log("sales-import: nothing to import");
		return empty;
	}

	// ---- 2. raw rows: LLM first, parsers as the fallback --------------------
	let rawLeads: Record<string, unknown>[] = [];
	let format = "none";

	if (input.provider && input.model) {
		const answered = rt.attempt("llm-extract", () =>
			rt.llm({
				provider: input.provider as string,
				model: input.model as string,
				maxTokens: o.maxTokens,
				messages: [
					{ role: "system", content: EXTRACT_PROMPT },
					{ role: "user", content: sourceText },
				],
			}),
		);
		if (answered.ok) {
			const parsed = rt.attempt("llm-parse", () =>
				parseLeadsJson(answered.value.text),
			);
			if (parsed.ok && parsed.value.length > 0) {
				rawLeads = parsed.value;
				format = "llm";
			} else if (!parsed.ok) {
				errors.push({ stage: "llm", message: parsed.error });
			}
		} else {
			errors.push({ stage: "llm", message: answered.error });
		}
	}

	if (rawLeads.length === 0) {
		const parsed = rt.node("parse-leads", () =>
			sales.parseImportLeads({ text: sourceText }),
		);
		rawLeads = parsed.leads as unknown as Record<string, unknown>[];
		format = parsed.format;
	}

	const normalized = rt.node("normalize-leads", () =>
		sales.normalizeImportLeads({
			leads: rawLeads as any,
			defaultLang: o.defaultLang,
			defaultType: o.defaultType,
			tags: input.tags ?? [],
		}),
	);

	const result = {
		status: o.dryRun ? "dry-run" : "imported",
		format,
		parsed: normalized.items.length,
		dropped: normalized.dropped,
		leadsCreated: 0,
		leadsSkipped: 0,
		contactsCreated: 0,
		contactsSkipped: 0,
		sources,
		errors,
		items: normalized.items.map((item) => ({
			leadId: item.lead.id,
			description: item.lead.description,
			contacts: item.contacts.map((c) => ({
				id: c.id,
				type: c.type,
				value: c.value,
			})),
		})),
	};

	if (o.dryRun) {
		rt.set("sales-import:last-result", result);
		rt.log(`sales-import: DRY-RUN ${result.parsed} leads (${format})`);
		return result;
	}

	// ---- 3. persist --------------------------------------------------------
	for (const item of normalized.items) {
		const lead = item.lead;
		const written = rt.attempt(`add-lead:${lead.id}`, () => sales.addLead(lead));
		if (written.ok) {
			result.leadsCreated += 1;
		} else if (isConflict(written.error)) {
			result.leadsSkipped += 1;
		} else {
			errors.push({ id: lead.id, stage: "lead", message: written.error });
			continue; // no lead row -> its contacts and tags have nothing to hang on
		}

		for (const contact of item.contacts) {
			const saved = rt.attempt(`add-contact:${contact.id}`, () =>
				sales.addContact(contact),
			);
			if (saved.ok) result.contactsCreated += 1;
			else if (isConflict(saved.error)) result.contactsSkipped += 1;
			else errors.push({ id: contact.id, stage: "contact", message: saved.error });
		}

		for (const tag of item.tags) {
			const tagged = rt.attempt(`tag:${lead.id}:${tag}`, () =>
				sales.assignLeadTag(lead.id, tag),
			);
			if (!tagged.ok && !isConflict(tagged.error))
				errors.push({ id: lead.id, stage: "tag", message: tagged.error });
		}
	}

	rt.set("sales-import:last-result", result);
	rt.log(
		`sales-import: ${format} parsed=${result.parsed} leads=${result.leadsCreated}/+${result.leadsSkipped} ` +
			`contacts=${result.contactsCreated}/+${result.contactsSkipped} errors=${errors.length}`,
	);
	return result;
};
