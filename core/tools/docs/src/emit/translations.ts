/**
 * Stitches the docs tree into `core/tools/translation`.
 *
 * That tool compares `<root>/<locale>/<rest>` trees and takes one root per
 * project. A `docs` directory is exactly that shape — language first, section
 * below it — so every discovered root becomes a project and the tool can track
 * translation drift in the sources, where it is fixable, instead of in the
 * generated stores, where a fix would be overwritten by the next build.
 *
 * The generated config is scanned with:
 *
 *   bun run scan --config <business>/build/docs/translation-control.json
 */

import { relative } from "node:path";
import type { Writer } from "../fs";
import type { Config, ScanSummary } from "../types";

type Project = {
	name: string;
	root: string;
	sourceLocale: string;
	targetLocales: string[];
	include: string[];
	stateFile: string;
	reportFile: string;
};

function relativeTo(from: string, path: string): string {
	const value = relative(from, path);
	return value.startsWith(".") ? value : `./${value}`;
}

export async function emitTranslations(
	summary: ScanSummary,
	config: Config,
	writer: Writer,
) {
	const {
		sourceLocale,
		targetLocales,
		config: target,
		stateDir,
	} = config.translation;
	const dir = target.replace(/\/[^/]+$/, "");
	const projects: Project[] = [];
	const skipped: string[] = [];

	for (const root of summary.roots) {
		// A root without the source language has nothing to compare against, and
		// translation-control treats that as a fatal error rather than a skip.
		if (!root.langs.includes(sourceLocale)) {
			skipped.push(root.owner);
			continue;
		}

		projects.push({
			name: root.owner,
			root: relativeTo(dir, root.path),
			sourceLocale,
			// Only languages someone actually asked for, minus the source itself.
			targetLocales: (targetLocales.length ? targetLocales : summary.langs)
				.filter((lang) => lang !== sourceLocale)
				.sort(),
			include: [],
			stateFile: relativeTo(dir, `${stateDir}/${root.owner}.state.json`),
			reportFile: relativeTo(dir, `${stateDir}/${root.owner}.report.json`),
		});
	}

	if (skipped.length > 0) {
		console.log(
			`[docs] translations: no "${sourceLocale}" source in ${skipped.join(", ")}`,
		);
	}

	await writer.write(target, `${JSON.stringify({ projects }, null, 2)}\n`);
	return projects;
}
