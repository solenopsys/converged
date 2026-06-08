/**
 * Reviews block — config-driven data shape.
 *
 * This is the JSON contract the landing renderer feeds in (see
 * `struct/data/en/product/landing/reviews.json`). The display model is kept
 * separate from the `ms-reviews` storage entity on purpose: the landing shows a
 * curated, presentation-ready slice (verified flag, avatar colour, relative
 * date), not the raw stored row.
 */

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export type Review = {
	id: string;
	/** Author display name, e.g. "Андрей Кузнецов". */
	name: string;
	/** Company, e.g. "«ТехноПрибор»". */
	company?: string;
	/** Author role / title, e.g. "гл. конструктор". */
	role?: string;
	/** Review body. */
	text: string;
	/** Whole-or-half star rating, 1–5. */
	rating: number;
	/** Marks the review as moderated / confirmed. */
	verified?: boolean;
	/** Human relative date, e.g. "2 нед. назад". */
	date?: string;
	/** Avatar background — any CSS colour (oklch in the design). */
	avatarColor?: string;
	/** Optional explicit initials; derived from `name` when omitted. */
	initials?: string;
};

export type ReviewsAggregate = {
	/** Average score shown next to the title, e.g. 4.9. */
	rating: number;
	/** Total number of reviews behind the average. */
	count: number;
};

export type ReviewsData = {
	enabled?: boolean;
	/** Section heading, e.g. "Отзывы". */
	title?: string;
	/** Aggregate rating summary shown in the header. */
	aggregate?: ReviewsAggregate;
	/** Id of the review pinned as the featured one; defaults to the first. */
	featuredId?: string;
	reviews: Review[];
	/** Carousel "expand" control label. */
	viewAllLabel?: string;
	/** Carousel "collapse" control label. */
	collapseLabel?: string;
};
