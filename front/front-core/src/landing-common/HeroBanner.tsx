"use client";

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
      <style>{heroBannerCss}</style>
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

export const heroBannerCss = `
.hero-banner {
  --hero-banner-fade-start: 70%;
  --hero-banner-page: #050506;
  --hero-banner-ink: #f8fafc;
  --hero-banner-muted: rgba(248, 250, 252, 0.76);
  --hero-banner-secondary: rgba(248, 250, 252, 0.64);
  --hero-banner-overlay-top: rgba(2, 6, 12, 0.42);
  --hero-banner-overlay-bottom: rgba(2, 6, 12, 0.74);
  --hero-banner-vignette: rgba(2, 6, 12, 0.72);
  position: relative;
  min-height: 560px;
  height: clamp(560px, 72vh, 760px);
  display: grid;
  place-items: center;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    #07101a 0%,
    #07101a var(--hero-banner-fade-start),
    transparent 100%
  );
}

.hero-banner[data-theme="light"] {
  --hero-banner-page: #f7f7f6;
  --hero-banner-ink: #ffffff;
  --hero-banner-muted: rgba(255, 255, 255, 0.78);
  --hero-banner-secondary: rgba(255, 255, 255, 0.62);
  --hero-banner-overlay-top: rgba(8, 14, 22, 0.34);
  --hero-banner-overlay-bottom: rgba(8, 14, 22, 0.64);
  --hero-banner-vignette: rgba(8, 14, 22, 0.54);
}

.hero-banner__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 48%;
  filter: saturate(0.86) contrast(1.04) brightness(0.78);
}

.hero-banner__overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, transparent 18%, var(--hero-banner-vignette) 100%),
    linear-gradient(180deg, var(--hero-banner-overlay-top), var(--hero-banner-overlay-bottom)),
    linear-gradient(90deg, rgba(2, 6, 12, 0.6), transparent 24%, transparent 76%, rgba(2, 6, 12, 0.6)),
    linear-gradient(180deg, rgba(2, 6, 12, 0.12), rgba(2, 6, 12, 0.34));
  pointer-events: none;
}

.hero-banner__image,
.hero-banner__overlay {
  -webkit-mask-image: linear-gradient(
    180deg,
    #000 0%,
    #000 var(--hero-banner-fade-start),
    transparent 100%
  );
  mask-image: linear-gradient(
    180deg,
    #000 0%,
    #000 var(--hero-banner-fade-start),
    transparent 100%
  );
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.hero-banner__content {
  position: relative;
  z-index: 1;
  width: min(860px, calc(100% - 40px));
  display: grid;
  justify-items: center;
  text-align: center;
  padding: 56px 0 68px;
}

.hero-banner--raised .hero-banner__content {
  width: min(1040px, calc(100% - 40px));
  gap: 20px;
  padding: 40px 0 60px;
  transform: translateY(-72px);
}

.hero-banner__badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(125, 211, 252, 0.32);
  background: rgba(125, 211, 252, 0.12);
  color: #e0f2fe;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
  padding: 4px 12px;
}

.hero-banner__title {
  position: relative;
  z-index: 2;
  margin: 0;
  color: var(--hero-banner-ink);
  font-size: clamp(44px, 7vw, 78px);
  font-weight: 800;
  letter-spacing: -0.065em;
  line-height: 0.98;
}

.hero-banner__title span {
  display: block;
}

.hero-banner__title span + span {
  color: var(--hero-banner-secondary);
}

.hero-banner__copy {
  position: relative;
  z-index: 2;
  width: min(620px, 100%);
  margin: 24px 0 0;
  color: var(--hero-banner-muted);
  font-size: clamp(16px, 1.9vw, 21px);
  font-weight: 400;
  letter-spacing: -0.025em;
  line-height: 1.42;
}

.hero-banner--raised .hero-banner__copy {
  margin: 0;
  font-size: clamp(16px, 1.9vw, 20px);
}

@media (max-width: 960px) {
  .hero-banner {
    min-height: 520px;
    height: clamp(520px, 68vh, 700px);
  }

  .hero-banner--raised .hero-banner__content {
    width: min(720px, calc(100% - 28px));
    transform: translateY(-64px);
  }

  .hero-banner--raised .hero-banner__title {
    font-size: 58px;
  }
}

@media (max-width: 720px) {
  .hero-banner {
    min-height: 520px;
    height: 76vh;
  }

  .hero-banner__content {
    width: min(100% - 28px, 540px);
  }
}

@media (max-width: 560px) {
  .hero-banner--raised {
    min-height: 500px;
    height: 66vh;
  }

  .hero-banner--raised .hero-banner__content {
    gap: 16px;
    padding-top: 24px;
    transform: translateY(-58px);
  }

  .hero-banner--raised .hero-banner__title {
    font-size: 44px;
  }

  .hero-banner--raised .hero-banner__copy {
    font-size: 16px;
  }
}
`;
