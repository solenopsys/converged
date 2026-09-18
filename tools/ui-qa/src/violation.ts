/**
 * What a finding is, and what makes two findings the same finding.
 *
 * Identity matters more than it looks: the baseline is keyed by it. It is
 * `rule|target|viewport|path|prop` and deliberately excludes the measured
 * value, so changing a wrong padding from 13px to 15px does not surface as a
 * brand-new violation — it is the same unresolved one. Adding the value would
 * make every partial fix look like a regression, which is how a baseline stops
 * being trusted.
 */

export type Severity = "info" | "warning" | "error";

export type Violation = {
	rule: string;
	severity: Severity;
	target: string;
	viewport: string;
	/** Element path from the snapshot, or a group key for aggregate rules. */
	path: string;
	selector: string;
	slot: string | null;
	prop: string;
	actual: string;
	expected: string;
	message: string;
};

export type RuleConfig = { enabled?: boolean; severity?: Severity };

export type Accepted = {
	rule?: string;
	slot?: string;
	/** Substring match against the element path. */
	path?: string;
	reason: string;
};

export type Config = {
	/** Subpixel slack: device pixel ratios and `calc(unit * 3.5)` are not bugs. */
	tolerancePx: number;
	/** sRGB distance below which a colour counts as a palette colour. */
	colorTolerance: number;
	minTouchTarget: number;
	/** Smallest group an aggregate rule will judge. */
	minGroup: number;
	rules: Record<string, RuleConfig>;
	/**
	 * Differences a human confirmed are intentional. This is where the AI layer
	 * writes: its output is a reviewable rule, not a verdict inside the run.
	 */
	accepted: Accepted[];
};

export const DEFAULT_CONFIG: Config = {
	tolerancePx: 0.5,
	colorTolerance: 10,
	minTouchTarget: 24,
	minGroup: 3,
	rules: {},
	accepted: [],
};

export function fingerprint(violation: Violation): string {
	return [
		violation.rule,
		violation.target,
		violation.viewport,
		violation.path,
		violation.prop,
	].join("|");
}

export function isAccepted(violation: Violation, config: Config): boolean {
	return config.accepted.some((entry) => {
		if (entry.rule && entry.rule !== violation.rule) return false;
		if (entry.slot && entry.slot !== violation.slot) return false;
		if (entry.path && !violation.path.includes(entry.path)) return false;
		return Boolean(entry.rule || entry.slot || entry.path);
	});
}

/** Numeric part of a computed length, or null for `auto` / `normal` / `%`. */
export function px(value: string | undefined): number | null {
	if (!value) return null;
	if (!value.endsWith("px")) return null;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function nearest(scale: number[], value: number): number | null {
	let best: number | null = null;
	for (const candidate of scale) {
		if (best === null || Math.abs(candidate - value) < Math.abs(best - value)) {
			best = candidate;
		}
	}
	return best;
}

export function onScale(
	scale: number[],
	value: number,
	tolerance: number,
): boolean {
	return scale.some((candidate) => Math.abs(candidate - value) <= tolerance);
}

export type Rgba = { r: number; g: number; b: number; a: number };

export function rgba(value: string | undefined): Rgba | null {
	if (!value) return null;
	const parts = value.match(/[\d.]+/g);
	if (!parts || parts.length < 3) return null;
	return {
		r: Number(parts[0]),
		g: Number(parts[1]),
		b: Number(parts[2]),
		a: parts.length > 3 ? Number(parts[3]) : 1,
	};
}

/**
 * Distance in sRGB, weighted the way the eye weighs the channels.
 *
 * Not CIEDE2000 — the job here is only to tell "this is the palette red" from
 * "this is a hand-picked red", and a weighted euclidean distance does that
 * without a colour-science dependency.
 */
export function colorDistance(a: Rgba, b: { r: number; g: number; b: number }) {
	const mean = (a.r + b.r) / 2;
	const dr = a.r - b.r;
	const dg = a.g - b.g;
	const db = a.b - b.b;
	return Math.sqrt(
		(2 + mean / 256) * dr * dr +
			4 * dg * dg +
			(2 + (255 - mean) / 256) * db * db,
	);
}

export function round(value: number): string {
	return `${Math.round(value * 100) / 100}px`;
}
