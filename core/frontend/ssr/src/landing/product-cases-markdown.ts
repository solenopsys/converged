import type { ResolvedBlock } from "front-core/landing";
import { createMarkdownServiceClient } from "g-markdown";
import { createSsrNrpcClientConfig } from "../nrpc";

type ProductCaseIndex = Record<string, unknown> & { markdown?: unknown };
type ProductCasesIndex = Record<string, unknown> & { cases?: unknown };

function localizedPath(path: string, locale: string): string {
	return path.startsWith(`${locale}/`) ? path : `${locale}/${path}`;
}


export async function loadProductCaseMarkdown(
	block: ResolvedBlock,
	locale: string,
	workspace?: string,
): Promise<Record<string, unknown>> {
	const source = block.data.cases as ProductCasesIndex;
	if (!Array.isArray(source?.cases)) return {};

	const cases = source.cases as ProductCaseIndex[];
	const paths = cases.map((item) => {
		if (typeof item.markdown !== "string" || !item.markdown.endsWith(".md")) {
			throw new Error(
				`[product-cases] missing markdown path for ${String(item.title)}`,
			);
		}
		return localizedPath(item.markdown, locale);
	});
	const markdown = createMarkdownServiceClient(
		createSsrNrpcClientConfig({ scope: workspace }),
	);
	const files = await Promise.all(paths.map((path) => markdown.readMd(path)));

	return {
		cases: {
			...source,
			cases: cases.map((item, index) => ({
				...item,
				description: files[index]?.content.trim() ?? "",
			})),
		},
	};
}
