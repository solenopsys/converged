/**
 * Everything that needs a browser, kept in one place.
 *
 * The rules below this file are pure; the impurity lives here. Two things it
 * owes them:
 *
 * A settled page. A measurement taken while a font is still swapping or a
 * skeleton is still up is not a fact about the interface, it is a fact about
 * the race — so a target is measured only after `document.fonts.ready` and a
 * short quiet period.
 *
 * A real session. The console is behind sign-in, and `tools/verify` already
 * enters it the way a person does (magic link, refresh cookie, no test-only
 * door). Re-implementing that here would be a second, worse copy, so a target
 * with a role borrows `verify`'s primitive — the console is addressed by URL,
 * which is exactly what makes this walk possible at all.
 */
import { chromium, type Page } from "@playwright/test";
import {
	CAPTURED_PROPS,
	extractSnapshot,
	type UiSnapshot,
	VENDOR_SELECTORS,
	type Viewport,
} from "./snapshot";
import { type DesignSpec, PROBE_DEFAULTS, probeSpec } from "./spec";

export type Target = {
	/** What the report calls it. */
	name: string;
	/** Absolute URL, or a path resolved against `baseURL`. */
	url?: string;
	path?: string;
	/** A `verify` role to sign in as; absent means visit as a guest. */
	role?: string;
};

export type RunOptions = {
	baseURL: string;
	targets: Target[];
	viewports: Viewport[];
	settleMs: number;
	maxElements: number;
	maxDepth: number;
	headless: boolean;
	onProgress?: (line: string) => void;
};

export type RunResult = {
	snapshots: UiSnapshot[];
	spec: DesignSpec;
	failures: Array<{ target: string; viewport: string; error: string }>;
};

export const DEFAULT_VIEWPORTS: Viewport[] = [
	{ name: "390px", width: 390, height: 844, dpr: 2 },
	{ name: "768px", width: 768, height: 1024, dpr: 2 },
	{ name: "1440px", width: 1440, height: 900, dpr: 1 },
];

const EMPTY_SPEC: DesignSpec = {
	baseUnit: 0,
	spacing: [],
	radius: [],
	fontSizes: [],
	fontWeights: [],
	fontFamilies: [],
	palette: [],
	shadows: [],
	lengths: {},
	tokens: {},
};

/**
 * Union of two probes.
 *
 * A token like `--hw-text-display: clamp(52px, 5vw, 76px)` resolves to a
 * different number per viewport, and all of those numbers are legitimate — so
 * the scales accumulate across viewports instead of the last one winning.
 */
export function mergeSpec(base: DesignSpec, next: DesignSpec): DesignSpec {
	const numbers = (a: number[], b: number[]) =>
		Array.from(new Set([...a, ...b])).sort((x, y) => x - y);
	const palette = [...base.palette];
	for (const entry of next.palette) {
		if (!palette.some((known) => known.token === entry.token)) {
			palette.push(entry);
		}
	}
	return {
		baseUnit: next.baseUnit || base.baseUnit,
		spacing: numbers(base.spacing, next.spacing),
		radius: numbers(base.radius, next.radius),
		fontSizes: numbers(base.fontSizes, next.fontSizes),
		fontWeights: numbers(base.fontWeights, next.fontWeights),
		fontFamilies: Array.from(
			new Set([...base.fontFamilies, ...next.fontFamilies]),
		),
		palette,
		shadows: Array.from(new Set([...base.shadows, ...next.shadows])),
		lengths: { ...base.lengths, ...next.lengths },
		tokens: { ...base.tokens, ...next.tokens },
	};
}

function urlOf(target: Target, baseURL: string): string {
	if (target.url) return target.url;
	const path = target.path ?? "/";
	if (/^[a-z]+:/i.test(path)) return path;
	return new URL(path, baseURL).toString();
}

async function settle(page: Page, settleMs: number): Promise<void> {
	await page.waitForLoadState("networkidle").catch(() => {});
	await page.evaluate(() => document.fonts.ready).catch(() => {});
	if (settleMs > 0) await page.waitForTimeout(settleMs);
}

export async function collect(options: RunOptions): Promise<RunResult> {
	const browser = await chromium.launch({ headless: options.headless });
	const snapshots: UiSnapshot[] = [];
	const failures: RunResult["failures"] = [];
	let spec = EMPTY_SPEC;

	try {
		for (const viewport of options.viewports) {
			const context = await browser.newContext({
				viewport: { width: viewport.width, height: viewport.height },
				deviceScaleFactor: viewport.dpr,
				locale: "en-US",
				timezoneId: "UTC",
			});
			// One page per viewport keeps the session — signing in once per
			// viewport instead of once per target is the difference between a
			// walk of thirty projections taking a minute and taking ten.
			const page = await context.newPage();
			let signedInAs: string | null = null;
			for (const target of options.targets) {
				options.onProgress?.(`${target.name} @ ${viewport.name}`);
				try {
					if (target.role && signedInAs !== target.role) {
						const { signInWith } = await import("../../verify/src/primitives");
						await signInWith(page)(target.role as "owner", {
							returnTo: target.path ?? "/console/",
						});
						signedInAs = target.role;
					} else {
						await page.goto(urlOf(target, options.baseURL), {
							waitUntil: "domcontentloaded",
						});
					}
					await settle(page, options.settleMs);
					spec = mergeSpec(
						spec,
						await page.evaluate(probeSpec, PROBE_DEFAULTS),
					);
					snapshots.push(
						await page.evaluate(extractSnapshot, {
							target: target.name,
							viewport,
							props: CAPTURED_PROPS as unknown as string[],
							vendorSelectors: VENDOR_SELECTORS,
							maxDepth: options.maxDepth,
							maxElements: options.maxElements,
						}),
					);
				} catch (error) {
					failures.push({
						target: target.name,
						viewport: viewport.name,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
			await context.close();
		}
	} finally {
		await browser.close();
	}

	return { snapshots, spec, failures };
}
