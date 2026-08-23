/**
 * The machine-readable side of a run.
 *
 * The report is JSON because its consumer is usually not a person: a
 * translation agent reads it to find out what to work on, and it needs the
 * affected paths and the offending strings, not a rendered summary.
 */

import { countIssues } from "./scan";
import type {
	ProjectSnapshot,
	ReportFile,
	ReportProject,
	TreeDiff,
} from "./types";

export function reportForProject(
	name: string,
	project: ProjectSnapshot,
): ReportProject {
	const files: ReportFile[] = [];

	for (const [file, snapshot] of Object.entries(project.files)) {
		for (const [locale, target] of Object.entries(snapshot.targets)) {
			if (target.status === "ok") continue;
			files.push({
				file,
				locale,
				status: target.status,
				reasons: target.reasons,
				structure: {
					missing: target.diff?.missing ?? [],
					extra: target.diff?.extra ?? [],
					typeChanged: target.diff?.typeChanged ?? [],
				},
				unchangedStrings: target.diff?.unchangedStrings ?? [],
				localeMismatches: target.diff?.localeMismatches ?? [],
			});
		}
	}

	return {
		name,
		root: project.root,
		sourceLocale: project.sourceLocale,
		targetLocales: project.targetLocales,
		issues: countIssues(project),
		files: files.sort((left, right) =>
			`${left.file}:${left.locale}`.localeCompare(
				`${right.file}:${right.locale}`,
			),
		),
		orphans: project.orphans,
		routes: project.routes,
	};
}

/** One-line summary of a diff, for the console. */
export function displayDiff(diff: TreeDiff | undefined): string {
	if (!diff) return "";
	const details: string[] = [];
	if (diff.missing.length) details.push(`missing ${diff.missing.length}`);
	if (diff.extra.length) details.push(`extra ${diff.extra.length}`);
	if (diff.typeChanged.length) details.push(`type ${diff.typeChanged.length}`);
	if (diff.unchangedStrings.length) {
		details.push(`unchanged text ${diff.unchangedStrings.length}`);
	}
	if (diff.localeMismatches.length) {
		details.push(`locale metadata ${diff.localeMismatches.length}`);
	}
	return details.length ? `; ${details.join(", ")}` : "";
}
