/**
 * The debt already in the tree, written down so CI can fail on new debt only.
 *
 * A first run against real code finds hundreds of things. A report of hundreds
 * is a report nobody reads, and a build that fails on all of them gets turned
 * off within the week — which is the actual failure mode of tools like this,
 * not inaccuracy. So the run answers a narrower and far more useful question:
 * *did this change make the interface worse?*
 *
 * Fixed findings are reported too. A finding that left the baseline is either a
 * repair worth noticing or a rule that stopped seeing its subject, and both are
 * things to know before pruning the file.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fingerprint, type Violation } from "./violation";

export type Baseline = {
	/** When the file was written, so a stale baseline is visible. */
	written: string;
	/** Fingerprint → the message it had when accepted, for readability. */
	entries: Record<string, string>;
};

export type Comparison = {
	fresh: Violation[];
	known: Violation[];
	/** Fingerprints in the baseline that nothing produced this run. */
	fixed: string[];
};

export function readBaseline(path: string): Baseline | null {
	if (!existsSync(path)) return null;
	const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<Baseline>;
	return {
		written: typeof raw.written === "string" ? raw.written : "",
		entries: raw.entries ?? {},
	};
}

export function writeBaseline(path: string, violations: Violation[]): Baseline {
	const entries: Record<string, string> = {};
	for (const violation of violations) {
		entries[fingerprint(violation)] = violation.message;
	}
	const baseline: Baseline = {
		written: new Date().toISOString(),
		entries,
	};
	writeFileSync(path, `${JSON.stringify(baseline, null, "\t")}\n`);
	return baseline;
}

export function compare(
	violations: Violation[],
	baseline: Baseline | null,
): Comparison {
	if (!baseline) return { fresh: violations, known: [], fixed: [] };
	const seen = new Set<string>();
	const fresh: Violation[] = [];
	const known: Violation[] = [];
	for (const violation of violations) {
		const print = fingerprint(violation);
		seen.add(print);
		if (print in baseline.entries) known.push(violation);
		else fresh.push(violation);
	}
	const fixed = Object.keys(baseline.entries).filter(
		(print) => !seen.has(print),
	);
	return { fresh, known, fixed };
}
