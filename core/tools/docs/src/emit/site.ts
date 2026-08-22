/**
 * The production target: split the books into the two stores the site reads,
 * `struct-ms` for indexes and `markdown-ms` for the markdown itself.
 *
 * Index entries carry a bare `id`, never a path. `mf-docs` resolves a bare id
 * against the folder its index came from, so bare ids keep the locale prefix
 * intact; an id containing a slash loses it and the markdown is never found.
 */

import { join } from "node:path";
import type { Writer } from "../fs";
import type { Book, Config, Doc } from "../types";

function entries(docs: Doc[], offset: number) {
	return docs.map((doc, index) => ({
		slug: doc.slug,
		title: doc.title,
		order: offset + index,
		id: doc.slug,
	}));
}

function json(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

async function emitFlat(book: Book, config: Config, writer: Writer) {
	const structDir = join(config.out.struct, book.lang, book.section);
	const markdownDir = join(config.out.markdown, book.lang, book.section);

	await writer.write(
		join(structDir, "index.json"),
		json(entries(book.docs, 0)),
	);
	for (const doc of book.docs) {
		await writer.copy(join(markdownDir, `${doc.slug}.md`), doc.source);
	}
}

async function emitCompound(book: Book, config: Config, writer: Writer) {
	const structDir = join(config.out.struct, book.lang, book.section);
	const markdownDir = join(config.out.markdown, book.lang, book.section);

	const groups = book.contributions.map((contribution) => ({
		group: contribution.group,
		// Locale-relative, because the consumer prefixes the locale itself.
		index: `${book.section}/${contribution.module}/index.json`,
	}));
	await writer.write(
		join(structDir, "index.json"),
		json({ compound: true, groups }),
	);

	let offset = 0;
	for (const contribution of book.contributions) {
		await writer.write(
			join(structDir, contribution.module, "index.json"),
			json(entries(contribution.docs, offset)),
		);
		offset += contribution.docs.length;

		for (const doc of contribution.docs) {
			await writer.copy(
				join(markdownDir, contribution.module, `${doc.slug}.md`),
				doc.source,
			);
		}
	}
}

export async function emitSite(books: Book[], config: Config, writer: Writer) {
	for (const book of books) {
		if (book.compound) await emitCompound(book, config, writer);
		else await emitFlat(book, config, writer);
	}
}
