/** Emits one manifest per project for every distributed documentation root. */

import { join, relative } from "node:path";
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
				const indexPath = join(root.path, id, "index.json");
				const entries = (await Bun.file(indexPath).json()) as IndexEntry[];
				sections.push({
					id,
					index: relative(project, indexPath),
					articles: entries.map((entry) => ({
						slug: entry.slug,
						file: relative(
							project,
							join(root.path, id, `${entry.id ?? entry.slug}.md`),
						),
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
