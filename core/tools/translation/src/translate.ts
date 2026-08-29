/** OpenAI-backed translation pass for files the scanner says need work. */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compareJson } from "./compare";
import { targetFilePath } from "./scan";
import type { TranslationStore } from "./store";
import type { JsonValue, ProjectConfig, ProjectSnapshot } from "./types";

type Job = {
	id: string;
	file: string;
	type: "json" | "markdown" | "other";
	content: string;
	target: string;
	sourceHash: string;
};

type TranslationResponse = {
	output_text?: string;
	output?: Array<{
		content?: Array<{ type?: string; text?: string }>;
	}>;
	error?: { message?: string };
};

const BATCH_SIZE = 8;
const MAX_BATCH_CHARS = 60_000;

function chunks(jobs: Job[]): Job[][] {
	const result: Job[][] = [];
	let current: Job[] = [];
	let size = 0;
	for (const job of jobs) {
		if (
			current.length &&
			(current.length >= BATCH_SIZE ||
				size + job.content.length > MAX_BATCH_CHARS)
		) {
			result.push(current);
			current = [];
			size = 0;
		}
		current.push(job);
		size += job.content.length;
	}
	if (current.length) result.push(current);
	return result;
}

function outputText(response: TranslationResponse): string {
	if (response.output_text) return response.output_text;
	for (const item of response.output ?? []) {
		for (const content of item.content ?? []) {
			if (content.type === "output_text" && content.text) return content.text;
		}
	}
	throw new Error(
		response.error?.message ?? "OpenAI response has no output text",
	);
}

function localeName(locale: string): string {
	return (
		new Intl.DisplayNames(["en"], { type: "language" }).of(locale) ?? locale
	);
}

async function requestBatch(
	jobs: Job[],
	locale: string,
	apiKey: string,
	model: string,
): Promise<Map<string, string>> {
	const response = await fetch("https://api.openai.com/v1/responses", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			store: false,
			instructions:
				`Translate every item from English to ${localeName(locale)} (${locale}). ` +
				"Preserve the exact document format. For JSON, keep every key, type, array order, ID, slug, URL, path, icon and code value; translate only human-readable string values. " +
				"For Markdown, preserve heading levels, links, URLs, placeholders, inline code and fenced code. Return every input id exactly once.",
			input: JSON.stringify({
				items: jobs.map(({ id, type, content }) => ({ id, type, content })),
			}),
			text: {
				format: {
					type: "json_schema",
					name: "document_translations",
					strict: true,
					schema: {
						type: "object",
						properties: {
							items: {
								type: "array",
								items: {
									type: "object",
									properties: {
										id: { type: "string" },
										translation: { type: "string" },
									},
									required: ["id", "translation"],
									additionalProperties: false,
								},
							},
						},
						required: ["items"],
						additionalProperties: false,
					},
				},
			},
		}),
	});
	const body = (await response.json()) as TranslationResponse;
	if (!response.ok) {
		throw new Error(
			`OpenAI ${response.status}: ${body.error?.message ?? "request failed"}`,
		);
	}
	const parsed = JSON.parse(outputText(body)) as {
		items?: Array<{ id?: string; translation?: string }>;
	};
	const translations = new Map(
		(parsed.items ?? []).map((item) => [item.id ?? "", item.translation ?? ""]),
	);
	for (const job of jobs) {
		if (!translations.get(job.id)) {
			throw new Error(`OpenAI response omitted translation id ${job.id}`);
		}
	}
	return translations;
}

export async function translateProject(
	config: ProjectConfig,
	snapshot: ProjectSnapshot,
	store: TranslationStore,
): Promise<number> {
	const sourceRoot = resolve(
		snapshot.root,
		config.sourcePath ?? config.sourceLocale,
	);
	const byLocale = new Map<string, Job[]>();

	for (const [rel, file] of Object.entries(snapshot.files)) {
		for (const [locale, target] of Object.entries(file.targets)) {
			// An existing byte-identical English file is an intentional fallback.
			// There is nothing to translate until the target is removed or changes.
			if (target.exists && target.hash === file.sourceHash) continue;
			if (target.exists && store.has(file.sourceHash, locale, target.hash)) {
				continue;
			}
			const jobs = byLocale.get(locale) ?? [];
			const targetPath = targetFilePath(
				config,
				snapshot.targetRoot,
				locale,
				rel,
			);
			jobs.push({
				id: `${config.name}:${rel}:${locale}`,
				file: rel,
				type: file.fileType,
				content: readFileSync(resolve(sourceRoot, rel), "utf8"),
				target: targetPath,
				sourceHash: file.sourceHash,
			});
			byLocale.set(locale, jobs);
		}
	}
	if (byLocale.size === 0) return 0;
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) throw new Error("OPENAI_API_KEY is required for build:doc -t");
	const model = process.env.DOCS_TRANSLATION_MODEL;
	if (!model) {
		throw new Error("DOCS_TRANSLATION_MODEL is required for build:doc -t");
	}

	let translated = 0;
	const total = [...byLocale.values()].reduce(
		(sum, jobs) => sum + jobs.length,
		0,
	);
	console.log(`  translation queue: ${total} files (${model})`);
	for (const [locale, jobs] of byLocale) {
		let offset = 0;
		for (const batch of chunks(jobs)) {
			const first = offset + 1;
			const last = offset + batch.length;
			console.log(
				`  requesting ${config.name}/${locale} ${first}-${last}/${jobs.length}:`,
			);
			for (const job of batch) console.log(`    ${job.file}`);
			const translations = await requestBatch(batch, locale, apiKey, model);
			let saved = 0;
			for (const job of batch) {
				const content = translations.get(job.id) as string;
				if (job.type === "json") {
					let translatedJson: JsonValue;
					try {
						translatedJson = JSON.parse(content) as JsonValue;
					} catch (error) {
						const message =
							error instanceof Error ? error.message : String(error);
						console.log(
							`    skipped ${job.file}: model returned invalid JSON (${message})`,
						);
						continue;
					}
					const sourceJson = JSON.parse(job.content) as JsonValue;
					const diff = compareJson(
						sourceJson,
						translatedJson,
						config.validation,
						locale,
					);
					if (
						diff.missing.length ||
						diff.extra.length ||
						diff.typeChanged.length
					) {
						console.log(
							`    skipped ${job.file}: model changed JSON structure ` +
								`(missing ${diff.missing.length}, extra ${diff.extra.length}, type ${diff.typeChanged.length})`,
						);
						continue;
					}
				}
				store.save(job.sourceHash, locale, content, job.target);
				translated += 1;
				saved += 1;
			}
			console.log(`  saved ${config.name}/${locale} ${saved}/${batch.length}`);
			offset += batch.length;
		}
	}
	return translated;
}
