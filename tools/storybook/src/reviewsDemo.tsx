import type { ReviewsData } from "front-core";

/**
 * Demo data for the Reviews stories.
 *
 * Mirrors `struct/data/en/product/landing/reviews.json` so Storybook renders
 * exactly what the landing config feeds the block. The data is intentionally NOT
 * hardcoded inside the component — this is the JSON storage shape (kept in sync
 * with the file the same way `salesIslandDemo` mirrors `sales-island.json`).
 */

export const reviewsData: ReviewsData = {
	enabled: true,
	title: "Reviews",
	aggregate: { rating: 4.9, count: 128 },
	featuredId: "featured-1",
	viewAllLabel: "View all",
	collapseLabel: "Collapse",
	reviews: [
		{
			id: "featured-1",
			name: "Sergey Morozov",
			role: "shop owner",
			company: "SHOP-47",
			text: "We stopped keeping a dedicated person on intake. The tool takes the drawing, prices it and queues it — we only confirm. Over the quarter our request flow grew one and a half times.",
			rating: 5,
			verified: true,
			date: "1 week ago",
			avatarColor: "oklch(0.55 0.16 250)",
		},
		{
			id: "rev-andrey",
			name: "Andrey Kuznetsov",
			role: "chief designer",
			company: "TechnoPribor",
			text: "Dropped a STEP in the evening — price and lead time by morning. It used to take two days of back-and-forth. The part is dead-on in tolerance.",
			rating: 5,
			verified: true,
			date: "2 weeks ago",
			avatarColor: "oklch(0.55 0.16 250)",
		},
		{
			id: "rev-marina",
			name: "Marina Orlova",
			role: "procurement",
			company: "Aviadetal",
			text: 'A 400-piece run of milled housings in a week, zero defects. The chat answers to the point, no "a manager will get back to you".',
			rating: 5,
			verified: true,
			date: "1 month ago",
			avatarColor: "oklch(0.58 0.15 150)",
		},
		{
			id: "rev-dmitry",
			name: "Dmitry Lapin",
			role: "process engineer",
			company: "EnergoMash",
			text: "5-axis blade machining — right the first time. Knocked off one star only for upload: I had to resend the drawing in a different format.",
			rating: 4,
			verified: true,
			date: "1 month ago",
			avatarColor: "oklch(0.5 0.14 300)",
		},
		{
			id: "rev-elena",
			name: "Elena Sokolova",
			role: "production lead",
			company: "PromTech",
			text: "Quoting that used to eat a full day now happens while I drink my coffee. Uploaded the assembly, got a per-part breakdown back.",
			rating: 5,
			verified: true,
			date: "2 months ago",
			avatarColor: "oklch(0.6 0.15 30)",
		},
	],
};
