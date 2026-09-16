/** Rebuild source-hash links from the files that already exist in the cache.
 *
 * First adoption is legitimate, but ONLY on a first import: a target with no
 * history anywhere in the index is assumed to be a correct translation of the
 * current source. But an existing link is never rewritten: if this target
 * hash was previously linked to a *different* source hash, the source changed
 * while the target did not — the translation is stale, not a fresh
 * translation of the new source. Relinking it would erase the only evidence
 * that a retranslation is needed, so the old link is carried over untouched
 * and the pair stays queued as missing/stale.
 */

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

export function rebuildIndex(
	store: TranslationStore,
	snapshots: ProjectSnapshot[],
	/**
	 * True when `snapshots` covers every project that shares this index. Only
	 * then may links absent from them be dropped; a filtered run adopts what
	 * it saw and leaves the rest alone.
	 */
	complete = true,
): ReindexSummary {
	const records = new Map<string, TranslationRecord>();
	const previous = store.knownTargets();
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
					// fresh, and nothing would ever retranslate it. The old
					// link is carried over untouched so the next run still
					// sees this pair as stale/missing instead of settled.
					const old = records.get(linkedBefore) ?? {
						version: 1 as const,
						sourceHash: linkedBefore,
						translations: {},
					};
					const oldLinks = old.translations[locale] ?? [];
					if (!oldLinks.includes(target.hash)) oldLinks.push(target.hash);
					old.translations[locale] = oldLinks;
					records.set(linkedBefore, old);
					summary.stale += 1;
					summary.missing += 1;
					continue;
				}
				if (!linkedBefore && previous.size > 0) {
					// The index already tracks translations, but this exact
					// target content was never linked to ANY source. It is not
					// a first import — it is a target whose source changed
					// after its old link was lost. Adopting it here would
					// bless a stale file as fresh, so it stays missing until
					// translated.
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
	summary.changed = store.rebuild(records.values(), complete);
	return summary;
}
