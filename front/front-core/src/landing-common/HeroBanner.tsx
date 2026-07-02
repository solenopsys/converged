"use client";
import "./HeroBanner.css";

import type { ReactNode } from "react";

export type HeroBannerTheme = "dark" | "light";
export type HeroBannerContentPlacement = "center" | "raised";

export interface HeroBannerData {
	badge?: string;
	brand?: string;
	headline?: string;
	highlight?: string;
	description?: string;
	backgroundImage?: string;
	image?: {
		src?: string;
		alt?: string;
	};
}

export interface HeroBannerProps extends HeroBannerData {
	ariaLabel?: string;
	as?: "section" | "div";
	badgeContextName?: string;
	badgeEventName?: string;
	badgeIcon?: ReactNode;
	badgeLabel?: string;
	onBadgeClick?: () => void;
	children?: ReactNode;
	className?: string;
	contentClassName?: string;
	contentPlacement?: HeroBannerContentPlacement;
	id?: string;
	theme?: HeroBannerTheme;
}

export function HeroBanner({
	ariaLabel = "Landing hero",
	as = "section",
	badge,
	badgeContextName,
	badgeEventName,
	badgeIcon,
	badgeLabel,
	brand,
	headline,
	highlight,
	description,
	backgroundImage,
	image,
	children,
	className,
	contentClassName,
	contentPlacement = "center",
	id,
	onBadgeClick,
	theme = "dark",
}: HeroBannerProps) {
	const Component = as;
	const resolvedHeadline = headline || brand || "ask anything.";
	const resolvedImage = backgroundImage || image?.src;
	const rootClassName = [
		"hero-banner",
		contentPlacement === "raised" && "hero-banner--raised",
		className,
	]
		.filter(Boolean)
		.join(" ");
	const resolvedContentClassName = ["hero-banner__content", contentClassName]
		.filter(Boolean)
		.join(" ");
	const isBadgeButton = Boolean(onBadgeClick || badgeEventName);

	return (
		<Component
			id={id}
			className={rootClassName}
			data-theme={theme}
			aria-label={ariaLabel}
		>
			{resolvedImage ? (
				<img
					className="hero-banner__image"
					src={resolvedImage}
					alt=""
					aria-hidden="true"
				/>
			) : null}
			<div className="hero-banner__overlay" aria-hidden="true" />
			<div className={resolvedContentClassName}>
				{badge ? (
					isBadgeButton ? (
						<button
							className="hero-banner__badge hero-banner__badge--button"
							type="button"
							aria-label={badgeLabel || badge}
							title={badgeLabel || badge}
							onClick={onBadgeClick}
							data-landing-event={badgeEventName}
							data-landing-context-name={badgeContextName}
						>
							{badgeIcon ? (
								<span className="hero-banner__badge-icon">{badgeIcon}</span>
							) : null}
							<span>{badge}</span>
						</button>
					) : (
						<div className="hero-banner__badge">
							{badgeIcon ? (
								<span className="hero-banner__badge-icon">{badgeIcon}</span>
							) : null}
							<span>{badge}</span>
						</div>
					)
				) : null}
				<h1 className="hero-banner__title">
					<span>{resolvedHeadline}</span>
					{highlight ? <span>{highlight}</span> : null}
				</h1>
				{description ? (
					<p className="hero-banner__copy">{description}</p>
				) : null}
				{children}
			</div>
		</Component>
	);
}
