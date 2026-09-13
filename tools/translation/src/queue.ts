/**
 * What a translate run would do, decided once.
 *
 * The volume table and the translator have to agree exactly: a table that
 * promises 40 files and a run that then does 52 is worse than no table. So
 * the queue is built here, both callers read it, and the rule lives in one
 * place instead of being restated in the reporting path.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { targetFilePath } from "./scan";
import type { TranslationStore } from "./store";
import type { FileKind, ProjectConfig, ProjectSnapshot } from "./types";

export type Job = {
	id: string;
	project: string;
	file: string;
	locale: string;
	type: FileKind;
	content: string;
	target: string;
	sourceHash: string;
};

/**
 * Whole-file translation breaks on large structured JSON: the model must
 * reproduce every numeric token exactly and either truncates the structure
 * (missing keys) or gives up and answers in prose (invalid JSON). Above this
 * size, JSON goes string-by-string — only human-readable leaves travel to the
 * model while coordinates, ids and enums never leave the machine — and the
 * target is reassembled locally, so its structure matches by construction.
 */
export const JSON_STRING_LEVEL_THRESHOLD = 15_000;

export type Route = "whole-file" | "string-level";

export function routeFor(job: Job): Route {
	return job.type === "json" && job.content.length > JSON_STRING_LEVEL_THRESHOLD
		? "string-level"
		: "whole-file";
}

/**
 * A byte-identical English file is an intentional fallback ONLY when the
 * index links it as one. An unlinked identical copy is just a seed the build
 * left behind (the docs `syncCaches` pass reseeds missing locale files):
 * skipping it would make it untranslatable forever, so it goes through
 * translation and gets overwritten and linked.
 */
export function needsTranslation(
	store: TranslationStore,
	sourceHash: string,
	locale: string,
	target: { exists: boolean; hash: string },
): boolean {
	if (!target.exists) return true;
	return !store.has(sourceHash, locale, target.hash);
}

export const BATCH_SIZE = 8;
export const MAX_BATCH_CHARS = 60_000;

/**
 * String-level batches play by different rules than file batches: items are
 * tiny, so the count cap moves out of the way and the character budget does
 * the limiting. One diagrams file (~200–300 strings, a few KB of text) fits a
 * single request instead of dozens.
 */
export const STRING_BATCH_ITEMS = 150;
export const STRING_MAX_BATCH_CHARS = 60_000;

export function chunks<T extends { content: string }>(
	jobs: T[],
	batchSize = BATCH_SIZE,
	maxChars = MAX_BATCH_CHARS,
): T[][] {
	const result: T[][] = [];
	let current: T[] = [];
	let size = 0;
	for (const job of jobs) {
		if (
			current.length &&
			(current.length >= batchSize || size + job.content.length > maxChars)
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

export function buildQueue(
	config: ProjectConfig,
	snapshot: ProjectSnapshot,
	store: TranslationStore,
): Job[] {
	const sourceRoot = resolve(
		snapshot.root,
		config.sourcePath ?? config.sourceLocale,
	);
	const jobs: Job[] = [];

	for (const [rel, file] of Object.entries(snapshot.files)) {
		for (const [locale, target] of Object.entries(file.targets)) {
			if (!needsTranslation(store, file.sourceHash, locale, target)) continue;
			jobs.push({
				id: `${config.name}:${rel}:${locale}`,
				project: config.name,
				file: rel,
				locale,
				type: file.fileType,
				content: readFileSync(resolve(sourceRoot, rel), "utf8"),
				target: targetFilePath(config, snapshot.targetRoot, locale, rel),
				sourceHash: file.sourceHash,
			});
		}
	}
	return jobs;
}
