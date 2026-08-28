/** Rebuild source-hash links from the files that already exist in the cache. */

import type { TranslationRecord, TranslationStore } from "./store";
import type { ProjectSnapshot } from "./types";

export type ReindexSummary = {
	sources: number;
	targets: number;
	linked: number;
	english: number;
	missing: number;
	changed: number;
};

export function rebuildIndex(
	store: TranslationStore,
	snapshots: ProjectSnapshot[],
): ReindexSummary {
	const records = new Map<string, TranslationRecord>();
	const summary: ReindexSummary = {
		sources: 0,
		targets: 0,
		linked: 0,
		english: 0,
		missing: 0,
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
