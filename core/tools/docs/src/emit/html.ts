/**
 * The static-site target: one HTML file per section and language, with the
 * side menu the old renderer had, plus a per-language index linking them.
 */

import { join } from "node:path";
import type { Writer } from "../fs";
import { renderBook } from "../render/shell";
import type { Book, Config } from "../types";

function indexPage(lang: string, books: Book[]): string {
	const links = books
		.map(
			(book) =>
				`<li><a href="./${book.section}.html">${book.title}</a> <span>(${book.docs.length})</span></li>`,
		)
		.join("\n");

	return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><title>Docs — ${lang}</title></head>
<body><h1>Docs — ${lang}</h1><ul>
${links}
</ul></body>
</html>
`;
}

export async function emitHtml(books: Book[], config: Config, writer: Writer) {
	const byLang = new Map<string, Book[]>();

	for (const book of books) {
		await writer.write(
			join(config.out.html, book.lang, `${book.section}.html`),
			await renderBook(book),
		);
		byLang.set(book.lang, [...(byLang.get(book.lang) ?? []), book]);
	}

	for (const [lang, langBooks] of byLang) {
		await writer.write(
			join(config.out.html, lang, "index.html"),
			indexPage(lang, langBooks),
		);
	}
}
