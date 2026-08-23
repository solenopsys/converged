/**
 * The invalidation the tool used to lack.
 *
 * The headline case is the three-run scenario: change a source, scan, scan
 * again. Against the scan baseline alone the second scan clears the finding,
 * because the scan that reports a change is also the scan that records it.
 * Against the ledger it does not, and that is what these tests pin down.
 */

import { describe, expect, test } from "bun:test";
import { emptyLedger, prune, readEntry, record, verdict } from "./ledger";
import type { LedgerEntry } from "./types";

const entry = (from: string, translation: string): LedgerEntry => ({
	translatedFromHash: from,
	translationHash: translation,
	translatedAt: "2026-01-01T00:00:00.000Z",
});

describe("verdict", () => {
	test("a translation recorded against the current source is fresh", () => {
		expect(verdict(entry("src-1", "tgt-1"), "src-1", "tgt-1")).toBe("ok");
	});

	test("a source edited after translation makes it stale", () => {
		expect(verdict(entry("src-1", "tgt-1"), "src-2", "tgt-1")).toBe("stale");
	});

	test("staleness does not depend on how many times we looked", () => {
		const recorded = entry("src-1", "tgt-1");
		for (let scan = 0; scan < 10; scan += 1) {
			expect(verdict(recorded, "src-2", "tgt-1")).toBe("stale");
		}
	});

	test("a target nobody recorded is unrecorded, not fresh", () => {
		expect(verdict(undefined, "src-1", "tgt-1")).toBe("unrecorded");
	});

	test("a hand-edited translation invalidates its own record", () => {
		// The entry describes text that is no longer on disk, so its
		// translatedFromHash says nothing about the file that is.
		expect(verdict(entry("src-1", "tgt-1"), "src-1", "tgt-2")).toBe(
			"unrecorded",
		);
	});
});

describe("record", () => {
	test("round-trips through the ledger", () => {
		const ledger = emptyLedger();
		record(ledger, "docs", "guide.md", "ru", entry("src-1", "tgt-1"));

		expect(
			readEntry(ledger, "docs", "guide.md", "ru")?.translatedFromHash,
		).toBe("src-1");
		expect(readEntry(ledger, "docs", "guide.md", "de")).toBeUndefined();
		expect(readEntry(ledger, "other", "guide.md", "ru")).toBeUndefined();
	});

	test("re-recording replaces the previous entry", () => {
		const ledger = emptyLedger();
		record(ledger, "docs", "guide.md", "ru", entry("src-1", "tgt-1"));
		record(ledger, "docs", "guide.md", "ru", entry("src-2", "tgt-2"));

		const found = readEntry(ledger, "docs", "guide.md", "ru");
		expect(found?.translatedFromHash).toBe("src-2");
		expect(verdict(found, "src-2", "tgt-2")).toBe("ok");
	});

	test("locales are independent", () => {
		const ledger = emptyLedger();
		record(ledger, "docs", "guide.md", "ru", entry("src-1", "ru-1"));
		record(ledger, "docs", "guide.md", "de", entry("src-2", "de-1"));

		expect(
			verdict(readEntry(ledger, "docs", "guide.md", "ru"), "src-2", "ru-1"),
		).toBe("stale");
		expect(
			verdict(readEntry(ledger, "docs", "guide.md", "de"), "src-2", "de-1"),
		).toBe("ok");
	});
});

describe("prune", () => {
	test("drops entries whose source is gone and keeps the rest", () => {
		const ledger = emptyLedger();
		record(ledger, "docs", "kept.md", "ru", entry("a", "b"));
		record(ledger, "docs", "deleted.md", "ru", entry("c", "d"));

		expect(prune(ledger, "docs", ["kept.md"])).toEqual(["deleted.md"]);
		expect(readEntry(ledger, "docs", "kept.md", "ru")).toBeDefined();
		expect(readEntry(ledger, "docs", "deleted.md", "ru")).toBeUndefined();
	});

	test("an unknown project prunes nothing", () => {
		expect(prune(emptyLedger(), "missing", ["a.md"])).toEqual([]);
	});
});
