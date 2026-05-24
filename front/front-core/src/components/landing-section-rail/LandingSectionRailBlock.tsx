import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import {
  LandingSectionRail,
  LandingSectionRailCardFrame,
  type LandingSectionRailRenderState,
} from "./LandingSectionRail";
import { LandingSectionRailStyles } from "./styles";

export type LandingSectionRailInlinePart = {
  emphasis?: boolean;
  strong?: boolean;
  text: string;
};

export type LandingSectionRailInlineContent = string | LandingSectionRailInlinePart[];

export type LandingSectionRailBlockKind = "capabilities" | "machines" | "team";

export type LandingSectionRailBlockItem = {
  availability?: string;
  bullets?: string[];
  copy?: string;
  id: string;
  image?: string;
  imageAlt?: string;
  meta?: string;
  quote?: string;
  role?: string;
  status?: "busy" | "free" | string;
  title: string;
};

export type LandingSectionRailBlockData = {
  collapseLabel?: string;
  defaultExpanded?: boolean;
  eyebrow?: LandingSectionRailInlineContent;
  expandable?: boolean;
  initialActiveId?: string;
  items?: LandingSectionRailBlockItem[];
  kind: LandingSectionRailBlockKind;
  loop?: boolean;
  meta?: LandingSectionRailInlineContent;
  railLabel?: string;
  title: string;
  variant?: "default" | "compact" | "immersive";
  viewAllLabel?: string;
};

export function LandingSectionRailBlock({
  className,
  data,
}: {
  className?: string;
  data?: LandingSectionRailBlockData;
}) {
  const items = data?.items ?? [];
  if (!data || items.length === 0) return null;

  const kind = data.kind;
  const renderItem = (state: LandingSectionRailRenderState<LandingSectionRailBlockItem>) => {
    if (kind === "machines") return <MachineRailCard {...state} />;
    if (kind === "team") return <TeamRailCard {...state} />;
    return <CapabilityRailCard {...state} />;
  };

  const islandProps = JSON.stringify({
    itemIds: items.map((i) => i.id),
    loop: data.loop ?? true,
    expandable: data.expandable ?? true,
    collapseLabel: data.collapseLabel ?? "Collapse",
    viewAllLabel: data.viewAllLabel ?? "View all",
  });

  return (
    <div
      className={className}
      data-island="section-rail"
      data-island-load="visible"
      data-island-props={islandProps}
    >
      <LandingSectionRailBlockStyles />
      <LandingSectionRail
        className={cn("landing-section-rail-block", `landing-section-rail-block--${kind}`)}
        collapseLabel={data.collapseLabel}
        defaultExpanded={data.defaultExpanded}
        eyebrow={renderInlineContent(data.eyebrow)}
        expandable={data.expandable ?? true}
        initialActiveId={data.initialActiveId}
        items={items}
        loop={data.loop ?? true}
        meta={renderInlineContent(data.meta)}
        railLabel={data.railLabel ?? data.title}
        renderItem={renderItem}
        title={data.title}
        variant={data.variant ?? (kind === "machines" ? "immersive" : "default")}
        viewAllLabel={data.viewAllLabel}
      />
    </div>
  );
}

function renderInlineContent(value: LandingSectionRailInlineContent | undefined): ReactNode {
  if (!value) return null;
  if (typeof value === "string") return value;

  return value.map((part, index) => {
    const key = `${part.text}-${index}`;
    if (part.strong) return <strong key={key}>{part.text}</strong>;
    if (part.emphasis) return <em key={key}>{part.text}</em>;
    return <span key={key}>{part.text}</span>;
  });
}

function CapabilityRailCard({
  active,
  expanded,
  item,
}: LandingSectionRailRenderState<LandingSectionRailBlockItem>) {
  return (
    <LandingSectionRailCardFrame
      active={active}
      className="landing-section-rail-block-card landing-section-rail-block-card--capability"
      data-tone={active && !expanded ? "dark" : "light"}
    >
      <h3>{item.title}</h3>
      {item.copy ? <p>{item.copy}</p> : null}
      <RailFacts bullets={item.bullets} />
    </LandingSectionRailCardFrame>
  );
}

function MachineRailCard({ active, item }: LandingSectionRailRenderState<LandingSectionRailBlockItem>) {
  return (
    <LandingSectionRailCardFrame
      active={active}
      className="landing-section-rail-block-card landing-section-rail-block-card--machine"
    >
      <div className="landing-section-rail-block-machine-photo" data-active={active ? "true" : "false"}>
        {item.image ? (
          <img
            src={item.image}
            alt={item.imageAlt ?? ""}
            aria-hidden={item.imageAlt ? undefined : true}
          />
        ) : null}
      </div>
      <h3>{item.title}</h3>
      {item.meta ? <p>{item.meta}</p> : null}
      <RailFacts bullets={item.bullets} />
      {item.availability ? (
        <div className="landing-section-rail-block-status" data-status={item.status}>
          {item.availability}
        </div>
      ) : null}
    </LandingSectionRailCardFrame>
  );
}

function TeamRailCard({ active, item }: LandingSectionRailRenderState<LandingSectionRailBlockItem>) {
  const initials = item.title
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <LandingSectionRailCardFrame
      active={active}
      className="landing-section-rail-block-card landing-section-rail-block-card--team"
    >
      <div className="landing-section-rail-block-portrait">
        {item.image ? (
          <img
            src={item.image}
            alt={item.imageAlt ?? ""}
            aria-hidden={item.imageAlt ? undefined : true}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="landing-section-rail-block-team-header">
        <h3>{item.title}</h3>
        {item.role ? <p>{item.role}</p> : null}
      </div>
      {item.quote ? <p className="landing-section-rail-block-quote">“{item.quote}”</p> : null}
      <RailFacts bullets={item.bullets} />
    </LandingSectionRailCardFrame>
  );
}

function RailFacts({ bullets }: { bullets?: string[] }) {
  if (!bullets?.length) return null;
  return (
    <ul className="landing-section-rail-block-facts">
      {bullets.map((bullet) => (
        <li key={bullet}>{bullet}</li>
      ))}
    </ul>
  );
}

export const landingSectionRailBlockCss = `
.landing-section-rail-block {
  --topbar-page: var(--ui-background);
  --topbar-surface: var(--ui-card);
  --topbar-ink: var(--ui-foreground);
  --topbar-muted: var(--ui-muted-foreground);
  --topbar-border: var(--ui-border);
  --topbar-login: var(--ui-foreground);
  --landing-rail-card-width: 280px;
  --landing-rail-card-active-width: min(560px, calc(100vw - 42px));
  --landing-rail-card-height: 500px;
  padding: 78px max(18px, calc((100vw - 1500px) / 2 + 18px)) 58px;
}

.landing-section-rail-block--machines {
  --landing-rail-card-width: 320px;
  --landing-rail-card-active-width: min(660px, calc(100vw - 42px));
  --landing-rail-card-height: 594px;
}

.landing-section-rail-block--team {
  --landing-rail-card-height: 540px;
}

.landing-section-rail-block + .landing-section-rail-block {
  padding-top: 92px;
}

.landing-section-rail-block .landing-section-rail__header {
  margin-bottom: 46px;
  margin-left: var(--landing-rail-active-inset, 0px);
  max-width: var(--landing-rail-active-width, var(--landing-rail-card-active-width));
  position: relative;
  z-index: 1;
  transition: margin-left 180ms ease, max-width 180ms ease;
}

.landing-section-rail-block .landing-section-rail__title-group,
.landing-section-rail-block .landing-section-rail__title {
  max-width: none;
}

.landing-section-rail-block .landing-section-rail__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22px;
  margin-top: 30px;
}

.landing-section-rail-block .landing-section-rail__viewport {
  gap: 20px;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.landing-section-rail-block .landing-section-rail__viewport::-webkit-scrollbar {
  display: none;
}

.landing-section-rail-block .landing-section-rail__viewport[data-expanded="true"] {
  gap: 22px;
}

.landing-section-rail-block .landing-section-rail__viewport[data-expanded="true"] .landing-section-rail__card {
  min-height: 430px;
}

.landing-section-rail-block .landing-section-rail-card-frame {
  padding: 30px;
}

.landing-section-rail-block .landing-section-rail__mobile-nav {
  display: grid;
  grid-template-columns: 54px minmax(0, 180px) 54px;
  align-items: center;
  justify-content: center;
  gap: 32px;
  width: min(460px, 100%);
  margin: 0;
}

.landing-section-rail-block .landing-section-rail__mobile-nav[data-expanded="true"] {
  display: none;
}

.landing-section-rail-block .landing-section-rail__mobile-nav button {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 1px solid color-mix(in oklch, var(--landing-rail-ink) 14%, transparent);
  border-radius: 50%;
  background: color-mix(in oklch, var(--landing-rail-ink) 5%, transparent);
  color: var(--landing-rail-ink);
  cursor: pointer;
  font: inherit;
  padding: 0;
  transition: background 160ms ease, border-color 160ms ease, opacity 160ms ease, transform 160ms ease;
}

.landing-section-rail-block .landing-section-rail__mobile-nav button span {
  display: block;
  color: currentColor;
  font-size: 30px;
  font-weight: 750;
  line-height: 1;
  transform: translateY(-2px);
}

.landing-section-rail-block .landing-section-rail__mobile-nav button:not(:disabled):hover {
  background: color-mix(in oklch, var(--landing-rail-ink) 9%, transparent);
  border-color: color-mix(in oklch, var(--landing-rail-ink) 24%, transparent);
  transform: translateY(-1px);
}

.landing-section-rail-block .landing-section-rail__mobile-nav button:disabled {
  cursor: default;
  opacity: 0.3;
}

.landing-section-rail-block .landing-section-rail__side {
  display: flex;
  align-items: center;
  gap: 14px;
}

.landing-section-rail-block .landing-section-rail__meta {
  padding: 0;
  color: color-mix(in oklch, var(--landing-rail-ink) 62%, transparent);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  text-align: left;
}

.landing-section-rail-block .landing-section-rail__expand {
  height: 54px;
  min-width: 116px;
  border-color: color-mix(in oklch, var(--landing-rail-ink) 14%, transparent);
  background: color-mix(in oklch, var(--landing-rail-ink) 5%, transparent);
  font-size: 15px;
  font-weight: 750;
  padding: 0 22px;
}

.landing-section-rail-block .landing-section-rail__expand:hover {
  background: color-mix(in oklch, var(--landing-rail-ink) 9%, transparent);
  border-color: color-mix(in oklch, var(--landing-rail-ink) 24%, transparent);
}

.landing-section-rail-block .landing-section-rail__mobile-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

.landing-section-rail-block .landing-section-rail__mobile-progress i {
  display: block;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: color-mix(in oklch, var(--landing-rail-ink) 22%, transparent);
  transition: background 160ms ease, width 160ms ease;
}

.landing-section-rail-block .landing-section-rail__mobile-progress i[data-active="true"] {
  width: 34px;
  background: var(--landing-rail-ink);
}

.landing-section-rail-block-card h3 {
  margin: 24px 0 18px;
  color: currentColor;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.12;
}

.landing-section-rail__card[data-active="true"] .landing-section-rail-block-card h3 {
  font-size: 40px;
  line-height: 1.06;
}

.landing-section-rail-block--team .landing-section-rail-block-card[data-active="true"] {
  border-color: color-mix(in oklch, var(--ui-border) 72%, var(--landing-rail-ink));
}

.landing-section-rail-block-team-header {
  display: grid;
  gap: 7px;
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid color-mix(in oklch, var(--ui-border) 78%, transparent);
}

.landing-section-rail-block-card--team h3,
.landing-section-rail__card[data-active="true"] .landing-section-rail-block-card--team h3 {
  margin: 0;
  font-size: 23px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.18;
}

.landing-section-rail-block-team-header p {
  margin: 0;
  color: var(--ui-muted-foreground);
  font-size: 14px;
  line-height: 1.35;
}

.landing-section-rail-block-card p {
  margin: 0;
  color: color-mix(in oklch, currentColor 64%, transparent);
  font-size: 16px;
  line-height: 1.62;
}

.landing-section-rail-block-card[data-tone="dark"] {
  background: var(--ui-foreground);
  color: var(--ui-background);
}

.landing-section-rail-block-facts {
  display: grid;
  gap: 13px;
  margin: auto 0 0;
  padding: 28px 0 0;
  list-style: none;
}

.landing-section-rail-block-facts li {
  color: color-mix(in oklch, currentColor 78%, transparent);
  font-size: 15px;
  font-weight: 650;
  line-height: 1.45;
}

.landing-section-rail-block-facts li::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: 0 9px 2px 0;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.45;
}

.landing-section-rail-block-machine-photo {
  position: relative;
  display: grid;
  place-items: start;
  overflow: visible;
  height: 150px;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.landing-section-rail-block-machine-photo[data-active="true"] {
  height: 250px;
}

.landing-section-rail-block-machine-photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  filter: saturate(0.9) contrast(1.03);
  transition: transform 220ms ease;
}

.landing-section-rail__card[data-active="true"] .landing-section-rail-block-machine-photo img {
  transform: scale(1.03);
}

.landing-section-rail-block-status {
  margin-top: 28px;
  color: var(--ui-muted-foreground);
  font-size: 15px;
  font-weight: 650;
}

.landing-section-rail-block-status::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 7px;
  border-radius: 999px;
  background: #22c55e;
}

.landing-section-rail-block-status[data-status="busy"]::before {
  background: color-mix(in oklch, var(--ui-muted-foreground) 60%, transparent);
}

.landing-section-rail-block-portrait {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  height: 220px;
  margin-bottom: 24px;
  border: 1px solid var(--ui-border);
  border-radius: 9px;
  background:
    repeating-linear-gradient(-45deg,
      color-mix(in oklch, var(--ui-muted) 92%, transparent) 0 5px,
      color-mix(in oklch, var(--ui-muted) 78%, transparent) 5px 9px),
    var(--ui-muted);
}

.landing-section-rail__card[data-active="true"] .landing-section-rail-block-portrait {
  height: 280px;
}

.landing-section-rail-block-card--team .landing-section-rail-block-portrait,
.landing-section-rail__card[data-active="true"] .landing-section-rail-block-card--team .landing-section-rail-block-portrait {
  height: 196px;
  margin-bottom: 22px;
  border-radius: 8px;
  background: color-mix(in oklch, var(--ui-muted) 72%, var(--ui-card));
}

.landing-section-rail-block-portrait img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 34%;
}

.landing-section-rail-block-portrait span {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 1px solid color-mix(in oklch, var(--ui-border) 86%, transparent);
  border-radius: 999px;
  background: color-mix(in oklch, var(--ui-card) 88%, transparent);
  color: var(--ui-muted-foreground);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.landing-section-rail-block-quote {
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--ui-muted-foreground);
  font-size: 14px;
  font-style: italic;
  line-height: 1.58;
}

.landing-section-rail-block-card--team .landing-section-rail-block-facts {
  gap: 9px;
  padding-top: 22px;
}

.landing-section-rail-block-card--team .landing-section-rail-block-facts li {
  color: color-mix(in oklch, var(--landing-rail-ink) 72%, transparent);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.35;
}

@media (max-width: 760px) {
  .landing-section-rail-block {
    padding: 54px 14px 44px;
  }

  .landing-section-rail-block + .landing-section-rail-block {
    padding-top: 64px;
  }

  .landing-section-rail-block .landing-section-rail__header {
    margin-bottom: 30px;
  }

  .landing-section-rail-block .landing-section-rail__controls {
    display: grid;
    gap: 16px;
    justify-content: stretch;
    margin-top: 18px;
  }

  .landing-section-rail-block .landing-section-rail__viewport {
    gap: 14px;
  }

  .landing-section-rail-block .landing-section-rail__mobile-nav {
    width: 100%;
    grid-template-columns: 54px minmax(0, 1fr) 54px;
  }

  .landing-section-rail-block .landing-section-rail__side {
    justify-content: space-between;
  }

  .landing-section-rail-block .landing-section-rail__card,
  .landing-section-rail-block .landing-section-rail__viewport[data-expanded="true"] .landing-section-rail__card {
    --landing-rail-card-height: 460px;
  }

  .landing-section-rail-block .landing-section-rail-card-frame {
    padding: 24px;
  }

  .landing-section-rail__card[data-active="true"] .landing-section-rail-block-card h3 {
    font-size: 32px;
  }

  .landing-section-rail-block-machine-photo,
  .landing-section-rail-block-machine-photo[data-active="true"] {
    height: 170px;
  }

  .landing-section-rail-block-portrait,
  .landing-section-rail__card[data-active="true"] .landing-section-rail-block-portrait {
    height: 230px;
  }

  .landing-section-rail-block-card--team .landing-section-rail-block-portrait,
  .landing-section-rail__card[data-active="true"] .landing-section-rail-block-card--team .landing-section-rail-block-portrait {
    height: 180px;
  }
}
`;

export function LandingSectionRailBlockStyles() {
  return (
    <>
      <LandingSectionRailStyles />
      <style>{landingSectionRailBlockCss}</style>
    </>
  );
}
