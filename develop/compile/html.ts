





export function indexHtmlTransform(
	indexHtmlBody: string,
	indexJs: string,
	importmap: object,
	entry: object ,
): string {
	const rewriter = new HTMLRewriter();

	console.log("IMPORTMAP",importmap)

	rewriter.on("*", {
		element(el) {
			console.log(el.tagName);

			if (el.tagName === "script") {
				if (el.getAttribute("type") === "module") {
					const entryString=JSON.stringify(entry, null, 2)
					const src =indexJs.replace("\"$TEMPLATE_ENTRY\"","`"+entryString+"`")
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
 

