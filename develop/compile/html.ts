





export function indexHtmlTransform(
	indexHtmlBody: string,
	indexJs: string,
	importmap: object,
	entry: object ,
): string {
	const rewriter = new HTMLRewriter();

	console.log("IMPORTMAP1",importmap)

	rewriter.on("*", {
		element(el) {
			console.log(el.tagName);

			if (el.tagName === "script") {
				if (el.getAttribute("type") === "module") {
					const src = `\nconst entry=JSON.parse(\`${JSON.stringify(entry, null, 2)}\`);\n${indexJs}
					`  ;

					el.setInnerContent(src, { html: false });
				}
				if (el.getAttribute("type") === "importmap") {
					el.setInnerContent(JSON.stringify(importmap, null, 2)
					, { html: false });
				}
			}
		},
	});

	return rewriter.transform(indexHtmlBody);
}
 

