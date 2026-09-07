import { describe, expect, test } from "bun:test";
import { type Evidence, statusFor } from "./status";
import type { TreeDiff } from "./types";

const clean = (over: Partial<Evidence> = {}): Evidence => ({
	tracked: true,
	targetExists: true,
	sourceChanged: false,
	targetModified: false,
	invalidJson: false,
	index: "ok",
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

	test("a missing target outranks everything except invalid JSON", () => {
		expect(
			statusFor(clean({ targetExists: false, index: "unrecorded" })).status,
		).toBe("missing");
		expect(
			statusFor(clean({ targetExists: false, invalidJson: true })).status,
		).toBe("invalid-json");
	});

	test("an unrecorded target is reported as such", () => {
		const { status, reasons } = statusFor(clean({ index: "unrecorded" }));
		expect(status).toBe("unrecorded");
		expect(reasons).toContain("not in translation index");
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
