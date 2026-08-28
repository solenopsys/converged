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

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { Writer } from "../fs";
import type { Book, Config, DocsRoot, ScanSummary } from "../types";

type Project = {
	name: string;
	root: string;
	sourcePath?: string;
	targetRoot?: string;
	targetPrefix?: string;
	targetStripPrefix?: string;
	sourceLocale: string;
	targetLocales: string[];
	include: string[];
	translationIndex: string;
};

function relativeTo(from: string, path: string): string {
	const value = relative(from, path);
	return value.startsWith(".") ? value : `./${value}`;
}

function cacheLocales(path: string): string[] {
	if (!path || !existsSync(path)) return [];
	return readdirSync(path, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && /^[a-z]{2,3}$/.test(entry.name))
		.map((entry) => entry.name);
}

export async function emitTranslations(
	summary: ScanSummary,
	books: Book[],
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
	const sourceFiles = (root: DocsRoot): string[] =>
		[
			...new Set(
				books
					.filter((book) => book.lang === sourceLocale)
					.flatMap((book) => book.docs)
					.filter((doc) => doc.module === root.owner)
					.map((doc) => relative(root.path, doc.source))
					.filter((path) => path && !path.startsWith("..")),
			),
		].sort();

	for (const root of summary.roots) {
		const docsCache = config.docsCaches.get(root.project) ?? "";
		const cache = docsCache
			? {
					targetRoot: relativeTo(dir, docsCache),
					...(root.path.includes("/modules/")
						? {
								targetPrefix: `modules/${root.owner}`,
								targetStripPrefix: "modules",
							}
						: {}),
					translationIndex: relativeTo(dir, join(docsCache, ".translation")),
				}
			: {
					translationIndex: relativeTo(dir, join(stateDir, ".translation")),
				};

		projects.push({
			name: root.owner,
			root: relativeTo(dir, root.path),
			sourcePath: ".",
			...cache,
			sourceLocale,
			// Only languages someone actually asked for, minus the source itself.
			targetLocales: (targetLocales.length ? targetLocales : summary.langs)
				.filter((lang) => lang !== sourceLocale)
				.sort(),
			// Only documents resolved by the docs generator are localizable.
			// The index itself remains a structural input for the site builder.
			include: sourceFiles(root),
		});
	}

	for (const store of ["struct", "markdown"]) {
		const source = join(config.content, store);
		const cache = join(config.contentCache, store);
		if (!config.content || !existsSync(join(source, sourceLocale))) continue;
		const name = `club-${store}`;
		projects.push({
			name,
			root: relativeTo(dir, source),
			...(config.contentCache
				? {
						targetRoot: relativeTo(dir, cache),
						translationIndex: relativeTo(
							dir,
							join(config.contentCache, ".translation"),
						),
					}
				: {
						translationIndex: relativeTo(dir, join(stateDir, ".translation")),
					}),
			sourceLocale,
			targetLocales: (targetLocales.length
				? targetLocales
				: cacheLocales(cache)
			)
				.filter((lang) => lang !== sourceLocale)
				.sort(),
			include: [],
		});
	}

	await writer.write(target, `${JSON.stringify({ projects }, null, 2)}\n`);
	return projects;
}
