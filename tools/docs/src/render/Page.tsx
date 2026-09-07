/** @jsxImportSource preact */
import { MarkdownRenderer } from "md-tools/renderer";
import type { MarkdownASTNode } from "md-tools/types";

export type RenderedDoc = {
	title: string;
	anchor: string;
	ast: MarkdownASTNode;
};

/**
 * The document body, rendered through the same `MarkdownRenderer` the site
 * uses, so the static build and the running product cannot drift apart.
 */
export function Page({ docs }: { docs: RenderedDoc[] }) {
	return (
		<main className="docs-content mx-auto w-full max-w-3xl px-8 py-10">
			{docs.map((doc) => (
				<section key={doc.anchor} id={doc.anchor} className="docs-section">
					<h1 className="mt-8 scroll-m-20 text-4xl font-bold tracking-tight first:mt-0 mb-6">
						{doc.title}
					</h1>
					<MarkdownRenderer ast={doc.ast} />
				</section>
			))}
		</main>
	);
}
