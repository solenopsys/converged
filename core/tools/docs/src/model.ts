/**
 * Turns raw per-module contributions into the `Book` objects the emitters
 * render: one section, one language, one ordered list of documents.
 */

import { scan } from "./discover";
import type { Book, Config, Contribution, ScanSummary } from "./types";

export type Filters = {
	sections?: string[];
	langs?: string[];
};

function sectionTitle(config: Config, section: string, lang: string): string {
	const titles = config.sections[section]?.title;
	return titles?.[lang] ?? titles?.en ?? section;
}

/**
 * Flat sections interleave contributions by `order`, which is what a single
 * owner — or a set of owners that agreed on a numbering — wants. Compound
 * sections keep each owner's block intact and only renumber across blocks,
 * because there the owner boundary is the visible structure.
 */
function orderDocs(contributions: Contribution[], compound: boolean) {
	const docs = compound
		? contributions.flatMap((c) => c.docs)
		: contributions.flatMap((c) => c.docs).sort((a, b) => a.order - b.order);

	return docs.map((doc, index) => ({ ...doc, order: index }));
}

function assertUniqueSlugs(key: string, contributions: Contribution[]) {
	const owner = new Map<string, string>();
	for (const contribution of contributions) {
		for (const doc of contribution.docs) {
			const previous = owner.get(doc.slug);
			if (previous) {
				throw new Error(
					`${key}: slug "${doc.slug}" is claimed by both ${previous} and ${contribution.module}`,
				);
			}
			owner.set(doc.slug, contribution.module);
		}
	}
}

export async function build(
	config: Config,
	filters: Filters = {},
): Promise<{ books: Book[]; summary: ScanSummary }> {
	const { contributions, roots, langs } = await scan(
		config.projects,
		config.cache,
	);
	const books: Book[] = [];

	for (const [key, list] of contributions) {
		const [section, lang] = key.split("/") as [string, string];
		if (filters.sections?.length && !filters.sections.includes(section))
			continue;
		if (filters.langs?.length && !filters.langs.includes(lang)) continue;

		// Stable, owner-name order so a compound index does not reshuffle
		// between runs on different machines.
		const ordered = [...list].sort((a, b) => a.module.localeCompare(b.module));
		const compound = config.sections[section]?.compound ?? ordered.length > 1;

		assertUniqueSlugs(key, ordered);

		books.push({
			section,
			lang,
			title: sectionTitle(config, section, lang),
			contributions: ordered,
			docs: orderDocs(ordered, compound),
			compound,
		});
	}

	books.sort(
		(a, b) =>
			a.section.localeCompare(b.section) || a.lang.localeCompare(b.lang),
	);

	return { books, summary: { roots, langs } };
}

/** Where a doc's markdown lands, relative to the markdown store root. */
export function markdownPath(
	book: Book,
	doc: { slug: string; module: string },
) {
	return book.compound
		? `${book.lang}/${book.section}/${doc.module}/${doc.slug}.md`
		: `${book.lang}/${book.section}/${doc.slug}.md`;
}
