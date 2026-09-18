/**
 * What every rule is: a pure function from a snapshot to findings.
 *
 * No rule touches the browser, the filesystem or the clock, which is why the
 * whole rule set is unit-testable from a literal snapshot (`rules.test.ts`) and
 * why a finding cannot be flaky. Anything that needs a page belongs in `run.ts`.
 */

import type { UiElement, UiSnapshot } from "../snapshot";
import type { DesignSpec } from "../spec";
import type { Config, Severity, Violation } from "../violation";

export type RuleContext = {
	snapshot: UiSnapshot;
	spec: DesignSpec;
	config: Config;
};

export type Rule = {
	id: string;
	severity: Severity;
	/** One line, printed in the report legend. */
	about: string;
	check(context: RuleContext): Violation[];
};

/** A rule that needs every snapshot at once, e.g. cross-projection checks. */
export type CrossRule = {
	id: string;
	severity: Severity;
	about: string;
	check(snapshots: UiSnapshot[], spec: DesignSpec, config: Config): Violation[];
};

export function finding(
	rule: Rule | CrossRule,
	snapshot: Pick<UiSnapshot, "target" | "viewport">,
	element: Pick<UiElement, "path" | "selector" | "slot">,
	fields: {
		prop: string;
		actual: string;
		expected: string;
		message: string;
	},
): Violation {
	return {
		rule: rule.id,
		severity: rule.severity,
		target: snapshot.target,
		viewport: snapshot.viewport.name,
		path: element.path,
		selector: element.selector,
		slot: element.slot,
		...fields,
	};
}
