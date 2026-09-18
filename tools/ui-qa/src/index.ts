/**
 * What `ui-qa` offers to other tools.
 *
 * The library half is the useful one: `collect` gives a machine-readable layer
 * of the interface as rendered, and the rules are pure functions over it. A
 * story in `tools/verify` can take its own snapshot mid-journey and assert on
 * it, without going through the CLI.
 */

export type { Baseline, Comparison } from "./baseline";
export { compare, readBaseline, writeBaseline } from "./baseline";
export { formatReport, summarize } from "./report";
export type { CrossRule, Rule, RuleContext } from "./rules";
export {
	ALL_CROSS_RULES,
	RULE_IDS,
	RULES,
	runCrossRules,
	runRules,
} from "./rules";
export type { RunOptions, RunResult, Target } from "./run";
export { collect, DEFAULT_VIEWPORTS, mergeSpec } from "./run";
export type { Box, UiElement, UiSnapshot, Viewport } from "./snapshot";
export {
	CAPTURED_PROPS,
	extractSnapshot,
	VENDOR_SELECTORS,
} from "./snapshot";
export type { DesignSpec, PaletteEntry } from "./spec";
export { PROBE_DEFAULTS, probeSpec } from "./spec";
export type { Config, Severity, Violation } from "./violation";
export { DEFAULT_CONFIG, fingerprint } from "./violation";
