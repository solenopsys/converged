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
  theme = "dark",
}: HeroBannerProps) {
  const Component = as;
  const resolvedHeadline = headline || brand || "ask anything.";
  const resolvedImage = backgroundImage || image?.src;
  const rootClassName = [
    "hero-banner",
    contentPlacement === "raised" && "hero-banner--raised",
    className,
  ].filter(Boolean).join(" ");
  const resolvedContentClassName = ["hero-banner__content", contentClassName].filter(Boolean).join(" ");

  return (
    <Component id={id} className={rootClassName} data-theme={theme} aria-label={ariaLabel}>
      {resolvedImage ? (
        <img className="hero-banner__image" src={resolvedImage} alt="" aria-hidden="true" />
      ) : null}
      <div className="hero-banner__overlay" aria-hidden="true" />
      <div className={resolvedContentClassName}>
        {badge ? <div className="hero-banner__badge">{badge}</div> : null}
        <h1 className="hero-banner__title">
          <span>{resolvedHeadline}</span>
          {highlight ? <span>{highlight}</span> : null}
        </h1>
        {description ? <p className="hero-banner__copy">{description}</p> : null}
        {children}
      </div>
    </Component>
  );
}

