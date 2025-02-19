

export function indexHtmlTransform(
	indexHtmlBody: string,
	indexJs: string,
	imports: object,
	entry: object ,
): string {
	const rewriter = new HTMLRewriter();

	rewriter.on("*", {
		element(el) {
			console.log(el.tagName);

			if (el.tagName === "script") {
				if (el.getAttribute("type") === "module") {
					const src = `\nconst entry=JSON.parse(\`${entry}\`);\n${indexJs}`  ;

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
 

