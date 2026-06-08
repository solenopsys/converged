/**
 * Reviews — featured review.
 *
 * The single strong review pinned above the lane. On a narrow section it sheds
 * its quotation mark and large type to read as a bold text block (driven by the
 * block's container query).
 */

import { ReviewAvatar, Stars, VerifiedBadge } from "./primitives";
import type { Review } from "./types";

export function FeaturedReview({
	review,
	ratingLabel = "rating",
}: {
	review: Review;
	ratingLabel?: string;
}) {
	return (
		<article className="review-feature">
			<div className="review-feature__mark" aria-hidden="true">
				“
			</div>
			<p className="review-feature__quote">{review.text}</p>
			<div className="review-feature__foot">
				<ReviewAvatar
					name={review.name}
					initials={review.initials}
					color={review.avatarColor}
					className="review-feature__avatar"
				/>
				<div className="review-feature__id">
					<div className="review-feature__name">
						{review.name}
						{review.verified ? <VerifiedBadge /> : null}
					</div>
					{review.role || review.company ? (
						<div className="review-feature__co">
							{[review.role, review.company].filter(Boolean).join(" · ")}
						</div>
					) : null}
				</div>
				<div className="review-feature__rating">
					<span className="review-feature__rating-label">{ratingLabel}</span>
					<Stars rating={review.rating} />
				</div>
			</div>
		</article>
	);
}
