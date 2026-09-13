/**
 * Offline translation validator. Read-only by design: it reports, it never
 * writes. The docs index is a structural input for the site builder, not a
 * translation artifact, so no verdict here may rewrite it.
 *
 * Only two checks survive, both structural and both provable from the files
 * alone:
 *
 * - `fallback-identical`: the target is a byte copy of the source AND the
 *   index links it as a translation. An unlinked copy is honest queue — the
 *   build seeds missing locale files with English — so only the link makes it
 *   a lie.
 * - `missing-index-file`: a docs `index.json` entry points at a document that
 *   does not resolve. This is the class that crashes the docs build.
 *
 * Language detection used to live here and is gone. It could only tell
 * Cyrillic from Latin, which left five of this project's six target languages
 * unchecked, fired on manifests that contain no prose, and reported a verdict
 * nobody could act on. A check that cannot distinguish the languages it is
 * pointed at is worse than no check: it produces noise that hides the two
 * findings above. Judging whether German copy is really German needs a
 * dictionary or an LLM, which is a separate tool, not a regex.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { targetFilePath } from "./scan";
import type { TranslationStore } from "./store";
import type { ProjectConfig, ProjectSnapshot } from "./types";

export type ValidationIssueKind = "fallback-identical" | "missing-index-file";

export type ValidationIssue = {
	project: string;
	/** Absolute path of the offending file. */
	file: string;
	locale: string;
	kind: ValidationIssueKind;
	detail: string;
};

/** Locales that are output formats, not languages. */
const NON_LANGUAGE_LOCALES = new Set(["pdf"]);

/**
 * Where an index entry's `id` resolves. Two layouts coexist and neither can
 * be guessed from the id alone:
 *
 * - docs caches keep a bare id and the document beside its index
 *   (`ru/system/cli.md` for `{"id": "cli"}`);
 * - the split struct/markdown stores keep a locale-relative key WITH its
 *   extension (`{"id": "club/intro.md"}`) whose document lives in the
 *   sibling markdown store, never beside the index.
 *
 * So every plausible candidate is tried and the entry resolves if any of them
 * exists. `indexContentRoot` names the sibling store when there is one; the
 * old behaviour of appending `.md` blindly is kept only as one candidate
 * among several, never as the sole rule.
 */
function resolvesIndexEntry(
	id: string,
	indexDir: string,
	localeRoot: string,
	contentRoot: string | undefined,
	locale: string,
): boolean {
	const names = id.endsWith(".md") ? [id] : [`${id}.md`, id];
	const bases = [indexDir, localeRoot];
	if (contentRoot) bases.push(join(contentRoot, locale));
	for (const base of bases) {
		for (const name of names) {
			if (existsSync(join(base, name))) return true;
		}
	}
	return false;
}

export function validateProject(
	config: ProjectConfig,
	snapshot: ProjectSnapshot,
	store: TranslationStore,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	for (const [rel, file] of Object.entries(snapshot.files)) {
		for (const [locale, target] of Object.entries(file.targets)) {
			// Print output formats are English by design, never translations.
			if (NON_LANGUAGE_LOCALES.has(locale)) continue;
			if (!target.exists) continue;
			if (target.hash !== file.sourceHash) continue;
			// Only a linked copy is a lie worth flagging: an unlinked identical
			// copy is honest queue, and flagging it would make every plain
			// build fail right after reseeding.
			if (!store.has(file.sourceHash, locale, target.hash)) continue;
			issues.push({
				project: config.name,
				file: targetFilePath(config, snapshot.targetRoot, locale, rel),
				locale,
				kind: "fallback-identical",
				detail: "index links a byte copy of the English source as translated",
			});
		}
	}

	// Docs index entries must resolve; a dangling one crashes the build.
	const contentRoot = config.indexContentRoot
		? join(snapshot.targetRoot, config.indexContentRoot)
		: undefined;
	const seen = new Set<string>();

	const checkDocIndex = (path: string, localeRoot: string, locale: string) => {
		if (seen.has(path)) return;
		seen.add(path);
		let entries: unknown;
		try {
			entries = JSON.parse(readFileSync(path, "utf8"));
		} catch {
			return;
		}
		if (!Array.isArray(entries)) return;
		const dir = join(path, "..");
		for (const entry of entries) {
			if (typeof entry !== "object" || entry === null) continue;
			const id = (entry as Record<string, unknown>).id;
			if (typeof id !== "string") continue;
			if (resolvesIndexEntry(id, dir, localeRoot, contentRoot, locale))
				continue;
			issues.push({
				project: config.name,
				file: path,
				locale,
				kind: "missing-index-file",
				detail: `index entry "${id}" resolves to no document`,
			});
		}
	};

	const read = (dir: string) => {
		try {
			return readdirSync(dir, { withFileTypes: true });
		} catch {
			return [];
		}
	};

	const walk = (dir: string, localeRoot: string, locale: string): void => {
		for (const entry of read(dir)) {
			if (entry.name.startsWith(".")) continue;
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(path, localeRoot, locale);
				continue;
			}
			if (entry.isFile() && entry.name === "index.json") {
				checkDocIndex(path, localeRoot, locale);
			}
		}
	};

	for (const locale of config.targetLocales) {
		if (NON_LANGUAGE_LOCALES.has(locale)) continue;
		const localeRoot = join(snapshot.targetRoot, locale);
		walk(localeRoot, localeRoot, locale);
	}

	return issues;
}
