/**
 * The `/docs` section of the site: an index of what exists, and the landing
 * config that renders it.
 *
 * The site had no way to ask "which sections are there". `sf-docs` answered it
 * by hard-coding a map of slugs to page groups and a list of Russian titles in
 * its own source, which is precisely the drift this tool exists to remove — a
 * new section could not appear without editing a component.
 *
 * So the index is emitted from the books that were just built. A section is on
 * the page because it was generated, and its title comes from the same
 * `docs.config.json` the rest of the build reads.
 */

import { join } from "node:path";
import type { Writer } from "../fs";
import type { Book, Config } from "../types";

/** One section as the `/docs` page reads it. */
type DocsSection = {
	id: string;
	title: string;
	/** Locale-relative index path; the consumer prefixes the locale. */
	index: string;
	/** How many articles it holds, for the section list. */
	count: number;
	/** True when the index groups articles by contributor. */
	compound: boolean;
};

/** Per-language copy, using English and then a literal when it is untranslated. */
function pick(
	values: Record<string, string> | undefined,
	lang: string,
	englishText: string,
): string {
	return values?.[lang] ?? values?.en ?? englishText;
}

function json(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * The page is one block over the index. Which article to show is decided from
 * the URL at request time, not baked into the config, so `/docs/<section>` and
 * `/docs/<section>/<slug>` are the same config with different data.
 */
function page(lang: string, title: string) {
	return {
		id: "docs",
		title,
		lang,
		blocks: [
			{
				id: "navbar",
				type: "navbar",
				sources: { ui: "landings/common/ui.json" },
			},
			{
				id: "docs",
				type: "docs",
				sources: { index: "docs/index.json", texts: "docs/texts.json" },
			},
		],
	};
}

export async function emitDocsPage(
	books: Book[],
	config: Config,
	writer: Writer,
): Promise<string[]> {
	const byLang = new Map<string, DocsSection[]>();

	for (const book of books) {
		const sections = byLang.get(book.lang) ?? [];
		sections.push({
			id: book.section,
			title: book.title,
			index: `docs/${book.section}/index.json`,
			count: book.docs.length,
			compound: book.compound,
		});
		byLang.set(book.lang, sections);
	}

	const englishSections = byLang.get("en") ?? [];
	const languages = new Set([
		...byLang.keys(),
		...config.translation.targetLocales,
	]);

	for (const lang of [...languages].sort()) {
		// English is the complete documentation source. Locale-specific sections
		// replace their English counterparts only after that section is translated.
		const sectionsById = new Map(
			englishSections.map((section) => [section.id, section]),
		);
		for (const section of byLang.get(lang) ?? []) {
			sectionsById.set(section.id, section);
		}
		const sections = [...sectionsById.values()];

		// Config order, so the site's chapter order is the one the config
		// declares rather than whatever the filesystem walk produced.
		const configured = Object.keys(config.sections);
		sections.sort((a, b) => {
			const left = configured.indexOf(a.id);
			const right = configured.indexOf(b.id);
			if (left !== right)
				return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
			return a.id.localeCompare(b.id);
		});

		const texts = {
			title: pick(config.docsPage.title, lang, "Documentation"),
			description: pick(config.docsPage.description, lang, ""),
			articles: pick(config.docsPage.articles, lang, "Articles"),
		};

		await writer.write(
			join(config.out.struct, lang, "docs", "index.json"),
			json({ sections }),
		);
		await writer.write(
			join(config.out.struct, lang, "docs", "texts.json"),
			json(texts),
		);
		await writer.write(
			join(config.out.struct, lang, "landings", "docs", "index.json"),
			json(page(lang, texts.title)),
		);
	}

	return [...byLang.keys()].sort();
}
