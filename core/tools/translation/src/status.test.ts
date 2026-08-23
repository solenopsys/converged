import { describe, expect, test } from "bun:test";
import { type Evidence, isRecordable, statusFor } from "./status";
import type { TreeDiff } from "./types";

const clean = (over: Partial<Evidence> = {}): Evidence => ({
	tracked: true,
	targetExists: true,
	sourceChanged: false,
	targetModified: false,
	invalidJson: false,
	ledger: "ok",
	...over,
});

const diff = (over: Partial<TreeDiff> = {}): TreeDiff => ({
	missing: [],
	extra: [],
	typeChanged: [],
	unchangedStrings: [],
	localeMismatches: [],
	sourceHash: "a",
	targetHash: "a",
	...over,
});

describe("statusFor", () => {
	test("nothing wrong is ok, with no reasons", () => {
		const { status, reasons } = statusFor(clean());
		expect(status).toBe("ok");
		expect(reasons).toEqual([]);
	});

	test("a stale translation outranks a scan-baseline change", () => {
		// Both are true after an edit; only one of them survives the next scan,
		// so the durable one is what the status names.
		const { status, reasons } = statusFor(
			clean({ ledger: "stale", sourceChanged: true }),
		);
		expect(status).toBe("stale");
		expect(reasons).toContain("source changed since translation");
		expect(reasons).toContain("source changed");
	});

	test("structure drift outranks staleness", () => {
		expect(
			statusFor(clean({ ledger: "stale", diff: diff({ missing: ["/a"] }) }))
				.status,
		).toBe("structure-drift");
	});

	test("untranslated text outranks staleness", () => {
		expect(
			statusFor(
				clean({
					ledger: "stale",
					diff: diff({
						unchangedStrings: [{ path: "/a", source: "x", target: "x" }],
					}),
				}),
			).status,
		).toBe("untranslated-text");
	});

	test("a missing target outranks everything except invalid JSON", () => {
		expect(
			statusFor(clean({ targetExists: false, ledger: "stale" })).status,
		).toBe("missing");
		expect(
			statusFor(clean({ targetExists: false, invalidJson: true })).status,
		).toBe("invalid-json");
	});

	test("an unrecorded target is reported as such", () => {
		const { status, reasons } = statusFor(clean({ ledger: "unrecorded" }));
		expect(status).toBe("unrecorded");
		expect(reasons).toContain("not in ledger");
	});

	test("a target the previous scan did not know about is untracked", () => {
		expect(statusFor(clean({ tracked: false })).status).toBe("untracked");
	});

	test("locale metadata alone is enough to fail", () => {
		expect(
			statusFor(
				clean({
					diff: diff({
						localeMismatches: [{ path: "/lang", expected: "ru", target: "en" }],
					}),
				}),
			).status,
		).toBe("untranslated-text");
	});
});

describe("isRecordable", () => {
	test("what cannot be claimed as translated", () => {
		expect(isRecordable("missing")).toBe(false);
		expect(isRecordable("invalid-json")).toBe(false);
	});

	test("everything else can be stamped once a human has fixed it", () => {
		for (const status of [
			"ok",
			"stale",
			"unrecorded",
			"structure-drift",
		] as const) {
			expect(isRecordable(status)).toBe(true);
		}
	});
});
