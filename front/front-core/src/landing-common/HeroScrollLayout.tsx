"use client";

import type { ReactNode } from "react";
import { LandingTopBar, type LandingTopBarProps } from "../components/landing-topbar/LandingTopBar";
import { HeroRequestBanner, type HeroRequestBannerProps } from "./HeroRequestBanner";

export interface HeroScrollLayoutProps {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  hero: HeroRequestBannerProps;
  topBar?: LandingTopBarProps | false;
}

export function HeroScrollLayout({
  children,
  className,
  contentClassName,
  hero,
  topBar,
}: HeroScrollLayoutProps) {
  const hasTopBar = Boolean(topBar);
  const rootClassName = ["hero-scroll-layout", className].filter(Boolean).join(" ");
  const resolvedContentClassName = ["hero-scroll-layout__content", contentClassName].filter(Boolean).join(" ");

  return (
    <div className={rootClassName} data-topbar={hasTopBar ? "1" : "0"}>
      <style>{heroScrollLayoutCss}</style>

      {topBar ? (
        <div className="hero-scroll-layout__topbar">
          <LandingTopBar compact {...topBar} />
        </div>
      ) : null}

      <div className="hero-scroll-layout__hero">
        <HeroRequestBanner {...hero} />
      </div>

      {children ? <div className={resolvedContentClassName}>{children}</div> : null}
    </div>
  );
}

export const heroScrollLayoutCss = `
.hero-scroll-layout {
  --hsl-topbar-height: 52px;
  --hsl-topbar-docked-height: 164px;
  --hsl-topbar-surface: color-mix(in oklch, var(--ui-card) 88%, transparent);
  background: var(--ui-background);
  color: var(--ui-foreground);
  min-height: 100vh;
}

.hero-scroll-layout__topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  height: var(--hsl-topbar-height);
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 80%, transparent);
  background: var(--ui-card);
  background: var(--hsl-topbar-surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: visible;
  transition:
    background 220ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease,
    height 320ms cubic-bezier(0.16, 1, 0.3, 1);
}

html[data-hero-input-docked="1"] .hero-scroll-layout__topbar {
  height: var(--hsl-topbar-docked-height);
  border-bottom-color: color-mix(in oklch, var(--ui-foreground) 12%, transparent);
  background: var(--ui-card);
  background: var(--hsl-topbar-surface);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.18);
}

.hero-scroll-layout__topbar .ltb--compact {
  position: relative;
  z-index: 1;
  background: transparent;
  border-bottom: 0;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.hero-scroll-layout[data-topbar="1"] .hero-scroll-layout__hero {
  padding-top: var(--hsl-topbar-height);
}

.hero-scroll-layout__content {
  position: relative;
  z-index: 0;
}
`;
