"use client";

import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  PackageCheck,
  Ruler,
  Upload,
} from "lucide-react";
import { HeroBanner, type HeroBannerData } from "./HeroBanner";
import { HeroInputDock, type HeroChip, type HeroInputDockMode } from "./HeroInputDock";

export interface HeroRequestBannerData extends HeroBannerData {
  request?: {
    placeholder?: string;
    submitLabel?: string;
    attachLabel?: string;
    contextName?: string;
    chips?: string[];
  };
}

export interface HeroRequestBannerProps {
  ariaLabel?: string;
  chips?: HeroChip[];
  data?: HeroRequestBannerData;
  id?: string;
  inputMode?: HeroInputDockMode;
  messageInputName?: string;
}

const DEFAULT_HERO_ACTIONS: HeroChip[] = [
  { icon: <BadgeCheck size={14} />, label: "Check drawing", prompt: "Check this drawing: " },
  { icon: <Upload size={14} />, label: "Upload file", prompt: "I want to upload a file for review." },
  { icon: <CalendarClock size={14} />, label: "Estimate deadline", prompt: "Estimate deadline: " },
  { icon: <ClipboardCheck size={14} />, label: "Request quote", prompt: "Prepare a quote: " },
  { icon: <PackageCheck size={14} />, label: "Choose material", prompt: "Help me choose material: " },
  { icon: <Ruler size={14} />, label: "Check tolerances", prompt: "Check tolerances: " },
];

export function HeroRequestBanner({
  ariaLabel = "Hero",
  chips,
  data,
  id = "request",
  inputMode = "effector",
  messageInputName = "hero_request_text",
}: HeroRequestBannerProps) {
  const request = data?.request ?? {};
  const headline = data?.headline || data?.brand || "Precision CNC machining";
  const description =
    data?.description ||
    "Send drawings, STEP/STL/DXF/PDF files or a plain text description. We collect the request details and prepare it for review.";
  const backgroundImage = data?.backgroundImage || data?.image?.src;
  const heroData: HeroBannerData = {
    ...data,
    backgroundImage,
    description,
    headline,
  };
  const placeholder =
    request.placeholder ||
    "Describe the part, material, quantity, tolerances, deadline and attach files in chat.";
  const resolvedChips = chips ?? resolveHeroChips(request.chips);

  return (
    <section id={id} className="hsl-root">
      <style>{heroRequestBannerCss}</style>

      <HeroBanner
        ariaLabel={ariaLabel}
        as="div"
        contentPlacement="raised"
        theme="dark"
        {...heroData}
      />

      <HeroInputDock
        attachLabel={request.attachLabel}
        chips={resolvedChips}
        contextName={request.contextName || "request"}
        messageInputName={messageInputName}
        mode={inputMode}
        placeholder={placeholder}
        submitLabel={request.submitLabel}
      />
    </section>
  );
}

function resolveHeroChips(labels?: string[]): HeroChip[] {
  if (!Array.isArray(labels) || labels.length === 0) {
    return DEFAULT_HERO_ACTIONS;
  }

  return labels.map((label, index) => {
    const fallback = DEFAULT_HERO_ACTIONS[index % DEFAULT_HERO_ACTIONS.length];
    return {
      icon: fallback.icon,
      label,
      prompt: `${label}: `,
    };
  });
}

export const heroRequestBannerCss = `
.hsl-root {
  --hsl-input-width: min(880px, calc(100vw - 40px));
  --hsl-topbar-height: 52px;
  --hsl-topbar-docked-height: 164px;
  width: 100%;
}

@media (max-width: 960px) {
  .hsl-root { --hsl-input-width: calc(100vw - 28px); }
}
`;
