import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import {
  LandingSectionRail,
  LandingSectionRailCardFrame,
  type LandingSectionRailRenderState,
} from "./LandingSectionRail";
import { LandingSectionRailStyles } from "./styles";
import "./LandingSectionRailBlock.css";

export type LandingSectionRailInlinePart = {
  emphasis?: boolean;
  strong?: boolean;
  text: string;
};

export type LandingSectionRailInlineContent = string | LandingSectionRailInlinePart[];

export type LandingSectionRailBlockKind = "capabilities" | "machines" | "team" | "works";

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
  imagePosition?: string;
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
    if (kind === "works") return <WorkRailCard {...state} />;
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
  item,
}: LandingSectionRailRenderState<LandingSectionRailBlockItem>) {
  return (
    <LandingSectionRailCardFrame
      active={active}
      className="landing-section-rail-block-card landing-section-rail-block-card--capability"
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

function WorkRailCard({ active, item }: LandingSectionRailRenderState<LandingSectionRailBlockItem>) {
  return (
    <LandingSectionRailCardFrame
      active={active}
      className="landing-section-rail-block-card landing-section-rail-block-card--work"
    >
      <div className="landing-section-rail-block-work-photo" data-active={active ? "true" : "false"}>
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
            style={item.imagePosition ? { objectPosition: item.imagePosition } : undefined}
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

export function LandingSectionRailBlockStyles() {
  return (
    <>
      <LandingSectionRailStyles />
    </>
  );
}
