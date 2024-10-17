import { join } from "path";

export function indexHtmlTransform(
	indexHtmlBody: string,
	indexJs: string,
	imports: any,
	entry: any,
): string {
	const rewriter = new HTMLRewriter();

	rewriter.on("*", {
		element(el) {
			console.log(el.tagName);

			if (el.tagName === "script") {
				if (el.getAttribute("type") === "module") {
					const src = `const entry=JSON.parse(\`${entry}\`);\n` + indexJs;

					el.setInnerContent(src, { html: false });
				}
				if (el.getAttribute("type") === "importmap") {
					el.setInnerContent(JSON.stringify({ imports }), { html: false });
				}
			}
		},
	});

	return rewriter.transform(indexHtmlBody);
}

import { IMPORT_MAP } from "../importmap";

export async function indexBuild(
	dirPath: string,
	dirBs: string,
): Promise<string> {
	const htmlStrng = await Bun.file(join(dirPath, "/index.html")).text();
	const scriptString = await Bun.file(join(dirPath, "/index.js")).text();
	const entryString = await Bun.file(join(dirBs, "/entry.json")).text();

	const htmlContent = await indexHtmlTransform(
		htmlStrng,
		scriptString,
		IMPORT_MAP,
		entryString,
	);
	return htmlContent;
}
