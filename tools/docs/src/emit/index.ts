/** Emits one manifest per project for every distributed documentation root. */

import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { MODULES_SECTION } from "../discover";
import type { Writer } from "../fs";
import type { Config, DocsRoot, IndexEntry } from "../types";

export async function emitContentIndexes(
	roots: DocsRoot[],
	config: Config,
	writer: Writer,
) {
	for (const project of config.projects) {
		const docs = [];
		for (const root of roots.filter((item) => item.project === project)) {
			const sections = [];
			for (const id of root.sections) {
				// A flat `docs/index.json` is the module layout: the index and
				// its articles sit in the docs root itself.
				const dir =
					id === MODULES_SECTION && existsSync(join(root.path, "index.json"))
						? root.path
						: join(root.path, id);
				const indexPath = join(dir, "index.json");
				const entries = (await Bun.file(indexPath).json()) as IndexEntry[];
				sections.push({
					id,
					index: relative(project, indexPath),
					articles: entries.map((entry) => ({
						slug: entry.slug,
						file: relative(project, join(dir, `${entry.id ?? entry.slug}.md`)),
					})),
				});
			}
			docs.push({
				owner: root.owner,
				path: relative(project, root.path),
				sections,
			});
		}

		await writer.write(
			join(project, "content", "index.json"),
			`${JSON.stringify(
				{
					version: 1,
					sourceLocale: config.translation.sourceLocale,
					docs,
				},
				null,
				2,
			)}\n`,
		);
	}
}
