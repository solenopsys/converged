/**
 * Reviews — config-driven landing block.
 *
 * Composition (top → bottom):
 *   - header: section title + aggregate rating;
 *   - the featured review (review #1), pinned above the lane;
 *   - the rest as a horizontal carousel, reusing the shared `LandingSectionRail`
 *     (same component every other landing rail uses) so scroll, the "View all"
 *     expand and mobile paging come for free and are hydrated by the existing
 *     `section-rail` island.
 *
 * When the section is squeezed, a container query (see Reviews.css) folds the
 * lane into a vertical compact list and flattens the featured card — matching
 * the design's narrow layout — without a second component tree.
 */

import { LandingSectionRail } from "../landing-section-rail/LandingSectionRail";
import { FeaturedReview } from "./FeaturedReview";
import { Stars } from "./primitives";
import { ReviewCard } from "./ReviewCard";
import type { Review, ReviewsData } from "./types";
import "./Reviews.css";

export function ReviewsBlock({
	className,
	data,
}: {
	className?: string;
	data?: ReviewsData;
}) {
	if (!data || data.enabled === false) return null;

	const reviews = data.reviews ?? [];
	if (reviews.length === 0) return null;

	const featured = pickFeatured(reviews, data.featuredId);
	const lane = reviews.filter((review) => review.id !== featured.id);

	const title = data.title ?? "Reviews";
	const viewAllLabel = data.viewAllLabel ?? "View all";
	const collapseLabel = data.collapseLabel ?? "Collapse";

	const islandProps = JSON.stringify({
		itemIds: lane.map((review) => review.id),
		expandable: true,
		collapseLabel,
		viewAllLabel,
	});

	return (
		<section
			className={className ? `reviews-block ${className}` : "reviews-block"}
		>
			<header className="reviews-block__head">
				<h2 className="reviews-block__title">{title}</h2>
				{data.aggregate ? (
					<span className="reviews-block__agg">
						<Stars rating={data.aggregate.rating} />
						<b>{data.aggregate.rating.toFixed(1)}</b>
						<span className="reviews-block__agg-count">
							· {data.aggregate.count} reviews
						</span>
					</span>
				) : null}
			</header>

			<FeaturedReview review={featured} />

			{lane.length > 0 ? (
				<div
					className="reviews-block__lane"
					data-island="section-rail"
					data-island-load="visible"
					data-island-props={islandProps}
				>
					<LandingSectionRail
						className="review-lane"
						title=""
						items={lane}
						expandable
						viewAllLabel={viewAllLabel}
						collapseLabel={collapseLabel}
						variant="default"
						railLabel={title}
						renderItem={({ item }) => <ReviewCard review={item} />}
					/>
				</div>
			) : null}
		</section>
	);
}

function pickFeatured(reviews: Review[], featuredId?: string): Review {
	if (featuredId) {
		const match = reviews.find((review) => review.id === featuredId);
		if (match) return match;
	}
	return reviews[0];
}
