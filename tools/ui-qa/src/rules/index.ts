/**
 * The rule set, and the only place severity and enablement are applied.
 *
 * A rule declares its own default severity and stamps it on every finding it
 * makes; the config's override is applied here, after the fact, so that a rule
 * stays a pure function of the snapshot and knows nothing about configuration
 * beyond the tolerances it measures with.
 */

import type { UiSnapshot } from "../snapshot";
import type { DesignSpec } from "../spec";
import { type Config, isAccepted, type Violation } from "../violation";
import type { CrossRule, Rule } from "./common";
import { CONSISTENCY_RULES, CROSS_RULES } from "./consistency";
import { LAYOUT_RULES } from "./layout";
import { TOKEN_RULES } from "./tokens";

export * from "./common";

export const RULES: Rule[] = [
	...LAYOUT_RULES,
	...TOKEN_RULES,
	...CONSISTENCY_RULES,
];

export const ALL_CROSS_RULES: CrossRule[] = CROSS_RULES;

export const RULE_IDS = [...RULES, ...ALL_CROSS_RULES].map((rule) => rule.id);

function enabled(id: string, config: Config): boolean {
	return config.rules[id]?.enabled !== false;
}

function graded(found: Violation[], id: string, config: Config): Violation[] {
	const override = config.rules[id]?.severity;
	return override
		? found.map((violation) => ({ ...violation, severity: override }))
		: found;
}

export function runRules(
	snapshot: UiSnapshot,
	spec: DesignSpec,
	config: Config,
): Violation[] {
	const found: Violation[] = [];
	for (const rule of RULES) {
		if (!enabled(rule.id, config)) continue;
		found.push(
			...graded(rule.check({ snapshot, spec, config }), rule.id, config),
		);
	}
	return found.filter((violation) => !isAccepted(violation, config));
}

export function runCrossRules(
	snapshots: UiSnapshot[],
	spec: DesignSpec,
	config: Config,
): Violation[] {
	const found: Violation[] = [];
	for (const rule of ALL_CROSS_RULES) {
		if (!enabled(rule.id, config)) continue;
		found.push(...graded(rule.check(snapshots, spec, config), rule.id, config));
	}
	return found.filter((violation) => !isAccepted(violation, config));
}
