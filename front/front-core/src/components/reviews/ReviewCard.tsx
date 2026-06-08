/**
 * Reviews — standard lane card.
 *
 * The horizontal carousel card. It also carries the markup the compact (narrow)
 * layout needs — an inline name row and a relative date — which the block's
 * container query reveals when the section is squeezed into a vertical list, so
 * the same card serves both layouts without a second component.
 */

import { ReviewAvatar, Stars, VerifiedBadge } from "./primitives";
import type { Review } from "./types";

export function ReviewCard({ review }: { review: Review }) {
	const score = review.rating.toFixed(1);
	return (
		<article className="review-card">
			<div className="review-card__top">
				<span className="review-card__rating">
					<Stars rating={review.rating} />
					<span className="review-card__score">{score}</span>
				</span>
				{review.verified ? <VerifiedBadge /> : null}
			</div>

			<div className="review-card__body">
				{/* Shown only in the compact vertical layout. */}
				<div className="review-card__name-inline">
					<span className="review-card__name-inline-nm">{review.name}</span>
					{review.company ? (
						<>
							<span className="review-card__name-inline-sep">·</span>
							<span className="review-card__name-inline-co">
								{review.company}
							</span>
						</>
					) : null}
				</div>
				<p className="review-card__quote">{review.text}</p>
				{review.date ? (
					<span className="review-card__date">{review.date}</span>
				) : null}
			</div>

			<div className="review-card__foot">
				<ReviewAvatar
					name={review.name}
					initials={review.initials}
					color={review.avatarColor}
				/>
				<div className="review-card__id">
					<div className="review-card__name">{review.name}</div>
					{review.role || review.company ? (
						<div className="review-card__co">
							{[review.role, review.company].filter(Boolean).join(" · ")}
						</div>
					) : null}
				</div>
			</div>
		</article>
	);
}
