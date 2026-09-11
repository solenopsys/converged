/** Rebuild source-hash links from the files that already exist in the cache.
 *
 * First adoption is legitimate: a target with no history is assumed to be a
 * correct translation of the current source. But an existing link is never
 * rewritten: if this target hash was previously linked to a *different*
 * source hash, the source changed while the target did not — the translation
 * is stale, not a fresh translation of the new source. Relinking it would
 * erase the only evidence that a retranslation is needed.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TranslationRecord, TranslationStore } from "./store";
import type { ProjectSnapshot } from "./types";

export type ReindexSummary = {
	sources: number;
	targets: number;
	linked: number;
	english: number;
	missing: number;
	stale: number;
	invalid: number;
	changed: number;
};

/** Every known `locale:targetHash` pair and the source hash it was linked to. */
function knownTargets(indexRoot: string): Map<string, string> {
	const known = new Map<string, string>();
	let names: string[] = [];
	try {
		names = readdirSync(indexRoot);
	} catch {
		return known;
	}
	for (const name of names) {
		if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
		let record: TranslationRecord;
		try {
			record = JSON.parse(
				readFileSync(join(indexRoot, name), "utf8"),
			) as TranslationRecord;
		} catch {
			continue;
		}
		if (record.version !== 1 || !record.translations) continue;
		for (const [locale, links] of Object.entries(record.translations)) {
			if (!Array.isArray(links)) continue;
			for (const targetHash of links) {
				const key = `${locale}:${targetHash}`;
				if (!known.has(key)) known.set(key, record.sourceHash);
			}
		}
	}
	return known;
}

export function rebuildIndex(
	store: TranslationStore,
	snapshots: ProjectSnapshot[],
): ReindexSummary {
	const records = new Map<string, TranslationRecord>();
	const previous = knownTargets(store.indexRoot);
	const summary: ReindexSummary = {
		sources: 0,
		targets: 0,
		linked: 0,
		english: 0,
		missing: 0,
		stale: 0,
		invalid: 0,
		changed: 0,
	};

	for (const snapshot of snapshots) {
		for (const file of Object.values(snapshot.files)) {
			summary.sources += 1;
			for (const [locale, target] of Object.entries(file.targets)) {
				summary.targets += 1;
				if (!target.exists) {
					summary.missing += 1;
					continue;
				}
				if (target.hash === file.sourceHash) {
					summary.english += 1;
					continue;
				}
				if (
					target.status === "invalid-json" ||
					target.diff?.missing.length ||
					target.diff?.extra.length ||
					target.diff?.typeChanged.length
				) {
					summary.invalid += 1;
					continue;
				}
				const linkedBefore = previous.get(`${locale}:${target.hash}`);
				if (linkedBefore && linkedBefore !== file.sourceHash) {
					// The target was translated from an older source. Adopting
					// it under the new hash would mark a stale translation as
					// fresh, and nothing would ever retranslate it.
					summary.stale += 1;
					summary.missing += 1;
					continue;
				}
				const record = records.get(file.sourceHash) ?? {
					version: 1 as const,
					sourceHash: file.sourceHash,
					translations: {},
				};
				const links = record.translations[locale] ?? [];
				if (!links.includes(target.hash)) links.push(target.hash);
				record.translations[locale] = links;
				records.set(file.sourceHash, record);
				summary.linked += 1;
			}
		}
	}

	for (const record of records.values()) {
		for (const links of Object.values(record.translations)) links.sort();
	}
	summary.changed = store.rebuild(records.values());
	return summary;
}
