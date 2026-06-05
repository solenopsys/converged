"use client";
import "./HeroScrollLayout.css";

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

