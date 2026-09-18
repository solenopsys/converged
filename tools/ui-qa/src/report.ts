/**
 * The report, written for a person deciding what to do next.
 *
 * "127 CSS violations" is not a result, it is a pile. Findings are grouped the
 * way they will be acted on — a flow that breaks on a phone is today's work, an
 * off-scale radius is a backlog item, one component with three appearances is a
 * conversation — and each group shows a few real examples instead of all of
 * them, because the file holds all of them anyway.
 */

import type { Comparison } from "./baseline";
import type { Violation } from "./violation";

const SECTIONS: Array<{
	title: string;
	match: (violation: Violation) => boolean;
}> = [
	{
		title: "Critical",
		match: (violation) => violation.severity === "error",
	},
	{
		title: "Cross-Projection",
		match: (violation) => violation.rule.startsWith("slot/"),
	},
	{
		title: "Design System",
		match: (violation) => violation.severity === "warning",
	},
	{
		title: "Notes",
		match: (violation) => violation.severity === "info",
	},
];

function byRule(violations: Violation[]): Map<string, Violation[]> {
	const groups = new Map<string, Violation[]>();
	for (const violation of violations) {
		const list = groups.get(violation.rule) ?? [];
		list.push(violation);
		groups.set(violation.rule, list);
	}
	return new Map(
		Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length),
	);
}

export type ReportOptions = {
	/** Examples printed per rule. */
	examples: number;
	targets: string[];
	viewports: string[];
	elements: number;
};

export function formatReport(
	comparison: Comparison,
	options: ReportOptions,
): string {
	const lines: string[] = [];
	lines.push(
		`ui-qa: ${options.targets.length} target(s) x ${options.viewports.length} viewport(s), ${options.elements} elements measured`,
	);
	lines.push(`  targets:   ${options.targets.join(", ")}`);
	lines.push(`  viewports: ${options.viewports.join(", ")}`);
	lines.push("");

	const claimed = new Set<Violation>();
	for (const section of SECTIONS) {
		const mine = comparison.fresh.filter(
			(violation) => !claimed.has(violation) && section.match(violation),
		);
		if (mine.length === 0) continue;
		for (const violation of mine) claimed.add(violation);
		lines.push(`${section.title} (${mine.length})`);
		for (const [rule, violations] of byRule(mine)) {
			lines.push(`  ${rule} — ${violations.length}`);
			for (const violation of violations.slice(0, options.examples)) {
				lines.push(
					`    ${violation.target} @ ${violation.viewport}  ${violation.path}`,
				);
				lines.push(`      ${violation.message}`);
			}
			if (violations.length > options.examples) {
				lines.push(`    … ${violations.length - options.examples} more`);
			}
		}
		lines.push("");
	}

	if (comparison.fresh.length === 0) {
		lines.push("No new violations.");
		lines.push("");
	}
	if (comparison.known.length > 0) {
		lines.push(`Known debt (in baseline): ${comparison.known.length}`);
	}
	if (comparison.fixed.length > 0) {
		lines.push(
			`Gone since the baseline: ${comparison.fixed.length} — fixed, or the rule lost its subject`,
		);
	}
	return lines.join("\n");
}

export function summarize(violations: Violation[]): Record<string, number> {
	const counts: Record<string, number> = { error: 0, warning: 0, info: 0 };
	for (const violation of violations) counts[violation.severity] += 1;
	return counts;
}
