/**
 * Reviews — shared leaf primitives.
 *
 * Small, self-contained pieces composed by both the standard card and the
 * featured review, so the markup never duplicates a star row or an avatar.
 */

const STAR_PATH =
	"M12 2.5l2.9 6.0 6.6.9-4.8 4.6 1.2 6.5L12 18.9 6.1 21.5l1.2-6.5L2.5 9.4l6.6-.9z";

const CHECK_PATH = "M20 6 9 17l-5-5";

const STAR_SLOTS = ["s1", "s2", "s3", "s4", "s5"] as const;

/** Clamp a rating to the renderable 0–5 range and round to whole stars. */
function filledStars(rating: number): number {
	return Math.max(0, Math.min(5, Math.round(rating)));
}

export function Stars({ rating, label }: { rating: number; label?: string }) {
	const filled = filledStars(rating);
	return (
		<span
			className="reviews-stars"
			role="img"
			aria-label={label ?? `${rating} out of 5`}
		>
			{STAR_SLOTS.map((slot, i) => (
				<svg key={slot} viewBox="0 0 24 24" aria-hidden="true">
					<path
						className={i < filled ? "reviews-star--on" : "reviews-star--off"}
						d={STAR_PATH}
					/>
				</svg>
			))}
		</span>
	);
}

export function VerifiedBadge({ label = "verified" }: { label?: string }) {
	return (
		<span className="reviews-verified">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.6"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d={CHECK_PATH} />
			</svg>
			{label}
		</span>
	);
}

/** First letters of the first two name words, e.g. "Андрей Кузнецов" → "АК". */
export function deriveInitials(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((word) => word[0] ?? "")
		.join("")
		.toUpperCase();
}

export function ReviewAvatar({
	name,
	initials,
	color,
	className,
}: {
	name: string;
	initials?: string;
	color?: string;
	className?: string;
}) {
	return (
		<span
			className={className ? `reviews-avatar ${className}` : "reviews-avatar"}
			style={color ? { background: color } : undefined}
			aria-hidden="true"
		>
			{initials ?? deriveInitials(name)}
		</span>
	);
}
