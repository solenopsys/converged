/**
 * The translation ledger: which source revision each translation was made from.
 *
 * This is the record the tool was missing. Scan state answers "did the source
 * change since I last looked", and that question destroys its own answer — the
 * scan that reports a change also writes the new hash into the baseline, so the
 * finding is gone on the next run even though nobody translated anything.
 *
 * The ledger answers "did the source change since this was translated". Only
 * `--record` writes it, and only when a translation is actually produced, so no
 * number of scans can clear a stale verdict. That is the difference between
 * reporting drift and being able to act on it.
 */

import { existsSync, readFileSync } from "node:fs";
import type { LedgerEntry, TranslationLedger } from "./types";

export type LedgerVerdict = "ok" | "stale" | "unrecorded";

export function emptyLedger(): TranslationLedger {
	return { version: 1, updatedAt: "", projects: {} };
}

export function readLedger(path: string): TranslationLedger {
	if (!existsSync(path)) return emptyLedger();
	const ledger = JSON.parse(readFileSync(path, "utf8")) as TranslationLedger;
	if (ledger.version !== 1 || !ledger.projects) {
		throw new Error(`Unsupported translation ledger format: ${path}`);
	}
	return ledger;
}

export function readEntry(
	ledger: TranslationLedger,
	project: string,
	rel: string,
	locale: string,
): LedgerEntry | undefined {
	return ledger.projects[project]?.files[rel]?.[locale];
}

/**
 * What the ledger says about a target that exists on disk.
 *
 * A recorded translation that no longer matches the file is treated as
 * unrecorded rather than ok: the entry describes some earlier text, so its
 * `translatedFromHash` says nothing about what is there now. Claiming
 * freshness on that basis would be worse than admitting ignorance.
 */
export function verdict(
	entry: LedgerEntry | undefined,
	sourceHash: string,
	targetHash: string,
): LedgerVerdict {
	if (!entry) return "unrecorded";
	if (entry.translationHash !== targetHash) return "unrecorded";
	return entry.translatedFromHash === sourceHash ? "ok" : "stale";
}

export function record(
	ledger: TranslationLedger,
	project: string,
	rel: string,
	locale: string,
	entry: LedgerEntry,
): void {
	const projectLedger = ledger.projects[project] ?? { files: {} };
	ledger.projects[project] = projectLedger;

	const file = projectLedger.files[rel] ?? {};
	projectLedger.files[rel] = file;

	file[locale] = entry;
}

/**
 * Drops entries for sources that no longer exist, so a deleted document does
 * not keep a translation alive in the ledger forever.
 */
export function prune(
	ledger: TranslationLedger,
	project: string,
	knownRels: Iterable<string>,
): string[] {
	const projectLedger = ledger.projects[project];
	if (!projectLedger) return [];

	const known = new Set(knownRels);
	const removed: string[] = [];
	for (const rel of Object.keys(projectLedger.files)) {
		if (known.has(rel)) continue;
		delete projectLedger.files[rel];
		removed.push(rel);
	}
	return removed.sort();
}
