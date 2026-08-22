/** @jsxImportSource preact */
import { MD_DIALECT_GITHUB, mdToJson } from "cruller-md4c";
import { render } from "preact-render-to-string";
import { stripLeadingHeading } from "../markdown";
import type { Book } from "../types";
import { Page, type RenderedDoc } from "./Page";
import { menuItems, SideMenu } from "./SideMenu";
import { buildStyles } from "./styles";

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"]/g,
		(char) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[
				char
			] as string,
	);
}

async function readDocs(book: Book): Promise<RenderedDoc[]> {
	const anchors = new Map(
		menuItems(book).map((item) => [item.slug, item.anchor]),
	);
	return Promise.all(
		book.docs.map(async (doc) => {
			// The page prints the index title, so the file's own `# ...` goes.
			const { body } = stripLeadingHeading(await Bun.file(doc.source).text());
			return {
				title: doc.title,
				anchor: anchors.get(doc.slug) ?? doc.slug,
				ast: mdToJson(body, { flags: MD_DIALECT_GITHUB }),
			};
		}),
	);
}

/** One book as one self-contained HTML file, styles inlined. */
export async function renderBook(book: Book): Promise<string> {
	const docs = await readDocs(book);
	const body = `<div class="docs-layout">${render(
		<>
			<SideMenu book={book} items={menuItems(book)} />
			<Page docs={docs} />
		</>,
	)}</div>`;

	const css = await buildStyles(body);

	return `<!DOCTYPE html>
<html lang="${book.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(book.title)}</title>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;
}
