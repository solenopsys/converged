/**
 * The production target: split the books into the two stores the site reads,
 * `struct-ms` for indexes and `markdown-ms` for the markdown itself.
 *
 * Index entries carry a bare `id`, never a path. `mf-docs` resolves a bare id
 * against the folder its index came from, so bare ids keep the locale prefix
 * intact; an id containing a slash loses it and the markdown is never found.
 */

import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import type { Writer } from "../fs";
import type { Book, CompoundIndexEntry, Config, Doc, DocsRoot } from "../types";
import { emitDocsPage } from "./docs-page";

const NON_LOCALES = new Set(["html", "pdf", "readme"]);

function entries(
	docs: Doc[],
	offset: number,
	owner?: string,
): CompoundIndexEntry[] {
	return docs.map((doc, index) => ({
		slug: doc.slug,
		title: doc.title,
		order: offset + index,
		id: doc.slug,
		...(owner ? { owner } : {}),
	}));
}

function json(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

async function emitFlat(book: Book, config: Config, writer: Writer) {
	const structDir = join(config.out.struct, book.lang, "docs", book.section);
	const markdownDir = join(
		config.out.markdown,
		book.lang,
		"docs",
		book.section,
	);

	await writer.write(
		join(structDir, "index.json"),
		json(entries(book.docs, 0)),
	);
	for (const doc of book.docs) {
		await writer.copy(join(markdownDir, `${doc.slug}.md`), doc.source);
	}
}

async function emitCompound(book: Book, config: Config, writer: Writer) {
	const structDir = join(config.out.struct, book.lang, "docs", book.section);
	const markdownDir = join(
		config.out.markdown,
		book.lang,
		"docs",
		book.section,
	);
	const groups = new Map<string, typeof book.contributions>();
	for (const contribution of book.contributions) {
		groups.set(contribution.group, [
			...(groups.get(contribution.group) ?? []),
			contribution,
		]);
	}
	const orderedGroups = [...groups.entries()]
		.map(([group, contributions]) => ({
			group,
			id:
				group
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-+|-+$/g, "") || "group",
			contributions,
		}))
		.sort((left, right) => left.id.localeCompare(right.id));

	const groupsIndex = orderedGroups.map(({ group, id }) => ({
		group,
		// Locale-relative, because the consumer prefixes the locale itself.
		index: `docs/${book.section}/groups/${id}/index.json`,
	}));
	await writer.write(
		join(structDir, "index.json"),
		json({ compound: true, groups: groupsIndex }),
	);

	let offset = 0;
	for (const { id, contributions } of orderedGroups) {
		let groupOffset = offset;
		const indexed = contributions.flatMap((contribution) => {
			const contributionEntries = entries(
				contribution.docs,
				groupOffset,
				contribution.module,
			);
			groupOffset += contribution.docs.length;
			return contributionEntries;
		});
		await writer.write(
			join(structDir, "groups", id, "index.json"),
			json(indexed),
		);
		offset = groupOffset;

		for (const contribution of contributions) {
			for (const doc of contribution.docs) {
				await writer.copy(
					join(markdownDir, contribution.module, `${doc.slug}.md`),
					doc.source,
				);
			}
		}
	}
}

/**
 * Publish nested documentation indexes and articles that a top-level book does
 * not enumerate. They are still part of the same source tree: solution,
 * module and platform pages link to them directly. Root section indexes stay
 * under the merger below, where several owners can form a compound book.
 */
async function emitNestedDocs(
	roots: DocsRoot[],
	config: Config,
	writer: Writer,
) {
	for (const root of roots) {
		await copyNestedDocs(
			root.path,
			config.translation.sourceLocale,
			config,
			writer,
		);
	}

	for (const cache of config.docsCaches.values()) {
		for (const lang of readdirSync(cache, { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isDirectory() &&
					/^[a-z]{2,3}$/.test(entry.name) &&
					!NON_LOCALES.has(entry.name),
			)
			.map((entry) => entry.name)
			.filter((lang) => lang !== config.translation.sourceLocale)) {
			await copyNestedDocs(join(cache, lang), lang, config, writer);
		}
	}
}

async function copyNestedDocs(
	langRoot: string,
	lang: string,
	config: Config,
	writer: Writer,
) {
	if (!existsSync(langRoot)) return;

	const visit = async (dir: string): Promise<void> => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (dir === langRoot && entry.name === "content") continue;
				await visit(path);
				continue;
			}
			if (!entry.isFile()) continue;

			const source = relative(langRoot, path);
			const isIndex = entry.name === "index.json";
			const isArticle = entry.name.endsWith(".md");
			// The top-level book is assembled below from every contributing owner.
			// Copying its article here creates a second, flat Markdown path beside
			// the owner-qualified path used by compound sections.
			const isTopLevelBookFile = source.split("/").length === 2;
			if ((!isIndex && !isArticle) || isTopLevelBookFile) continue;

			const target = isIndex
				? join(config.out.struct, lang, "docs", source)
				: join(config.out.markdown, lang, "docs", source);
			await writer.copy(target, path);
		}
	};

	await visit(langRoot);
}

export async function emitSite(
	books: Book[],
	roots: DocsRoot[],
	config: Config,
	writer: Writer,
) {
	await emitNestedDocs(roots, config, writer);
	for (const book of books) {
		if (book.compound) await emitCompound(book, config, writer);
		else await emitFlat(book, config, writer);
	}
	// The `/docs` page lists what was just written, so it is emitted from the
	// same books rather than by rediscovering the output.
	await emitDocsPage(books, config, writer);
}
