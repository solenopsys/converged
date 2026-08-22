/** @jsxImportSource preact */
import { anchorId } from "../markdown";
import type { Book } from "../types";

export type MenuItem = {
	slug: string;
	title: string;
	anchor: string;
	group?: string;
};

/**
 * The section list. Anchors, not routes: a book is one page, which is what the
 * PDF target needs and what keeps the static site free of a router.
 */
export function SideMenu({ book, items }: { book: Book; items: MenuItem[] }) {
	let group: string | undefined;

	return (
		<nav className="docs-menu w-64 shrink-0 border-r border-border px-4 py-8">
			<div className="mb-6 text-lg font-semibold tracking-tight">
				{book.title}
			</div>
			<ul className="space-y-1">
				{items.map((item) => {
					const heading = item.group && item.group !== group;
					if (heading) group = item.group;
					return (
						<>
							{heading ? (
								<li
									key={`g-${item.group}`}
									className="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
								>
									{item.group}
								</li>
							) : null}
							<li key={item.anchor}>
								<a
									href={`#${item.anchor}`}
									className="block rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
								>
									{item.title}
								</a>
							</li>
						</>
					);
				})}
			</ul>
		</nav>
	);
}

export function menuItems(book: Book): MenuItem[] {
	return book.docs.map((doc, index) => ({
		slug: doc.slug,
		title: doc.title,
		anchor: anchorId(doc.slug, index),
		group: book.compound
			? book.contributions.find((c) => c.module === doc.module)?.group
			: undefined,
	}));
}
