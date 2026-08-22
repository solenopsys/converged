/**
 * The GitHub target: each section collapses into one `README.md` with a table
 * of contents, the shape the old `gen-md` script produced and the shape a repo
 * front page wants.
 */

import { join } from "node:path";
import type { Writer } from "../fs";
import { demoteHeadings, githubAnchor, stripLeadingHeading } from "../markdown";
import type { Book, Config } from "../types";

async function renderBook(book: Book): Promise<string> {
	const parts: string[] = [`# ${book.title}`, ""];
	const toc: string[] = [];
	const body: string[] = [];

	let group: string | undefined;
	for (const contribution of book.contributions) {
		const grouped = book.compound && contribution.group !== group;
		if (grouped) {
			group = contribution.group;
			toc.push(`- **${group}**`);
			body.push(`## ${group}`, "");
		}

		for (const doc of contribution.docs) {
			const raw = await Bun.file(doc.source).text();
			const { body: content } = stripLeadingHeading(raw);
			// Docs sit one level under the section title, two when grouped, so
			// their own headings move down to match.
			const depth = book.compound ? 3 : 2;

			toc.push(
				`${grouped || book.compound ? "  " : ""}- [${doc.title}](#${githubAnchor(doc.title)})`,
			);
			body.push(`${"#".repeat(depth)} ${doc.title}`, "");
			body.push(demoteHeadings(content.trimEnd(), depth - 1), "");
		}
	}

	parts.push(...toc, "", ...body);
	return `${parts.join("\n").trimEnd()}\n`;
}

export async function emitReadme(
	books: Book[],
	config: Config,
	writer: Writer,
) {
	for (const book of books) {
		const path = join(config.out.readme, book.lang, `${book.section}.md`);
		await writer.write(path, await renderBook(book));
	}
}
