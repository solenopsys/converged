import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { cn } from "../../lib/utils";

const EDGE_SCROLL_MAX_SPEED = 18;
const EDGE_SCROLL_ZONE = 112;
const EDGE_SCROLL_MEDIA_QUERY = "(hover: hover) and (pointer: fine) and (min-width: 761px)";

export type LandingSectionRailBaseItem = {
  id: string;
};

export type LandingSectionRailRenderState<TItem extends LandingSectionRailBaseItem> = {
  active: boolean;
  activate: () => void;
  expanded: boolean;
  index: number;
  item: TItem;
};

export type LandingSectionRailProps<TItem extends LandingSectionRailBaseItem> = {
  activateOnScroll?: boolean;
  className?: string;
  collapseLabel?: ReactNode;
  defaultExpanded?: boolean;
  eyebrow?: ReactNode;
  expandable?: boolean;
  expanded?: boolean;
  initialActiveId?: string;
  items: TItem[];
  meta?: ReactNode;
  onExpandedChange?: (expanded: boolean) => void;
  railLabel?: string;
  renderItem: (state: LandingSectionRailRenderState<TItem>) => ReactNode;
  scrollActivationDelay?: number;
  title: ReactNode;
  viewAllLabel?: ReactNode;
  variant?: "default" | "compact" | "immersive";
};

export function LandingSectionRail<TItem extends LandingSectionRailBaseItem>({
  activateOnScroll = true,
  className,
  collapseLabel = "Collapse",
  defaultExpanded = false,
  eyebrow,
  expandable = false,
  expanded,
  initialActiveId,
  items,
  meta,
  onExpandedChange,
  railLabel,
  renderItem,
  scrollActivationDelay = 240,
  title,
  viewAllLabel = "View all",
  variant = "default",
}: LandingSectionRailProps<TItem>) {
  const fallbackActiveId = initialActiveId ?? items[0]?.id ?? "";
  const [activeId, setActiveId] = useState(fallbackActiveId);
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? uncontrolledExpanded;
  const activeIdRef = useRef(activeId);
  const suppressScrollActivationUntilRef = useRef(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const isExpandedRef = useRef(isExpanded);
  const edgeScrollFrameRef = useRef(0);
  const edgeScrollVelocityRef = useRef(0);
  const centerScrollFrameRef = useRef(0);
  const centerScrollTargetIdRef = useRef<string | null>(null);
  const centerScrollUntilRef = useRef(0);
  const itemsSignature = items.map((item) => item.id).join("\u001f");
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex >= 0 && activeIndex < items.length - 1;
  const hasControls = items.length > 1 || Boolean(meta) || expandable;

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    isExpandedRef.current = isExpanded;
    if (isExpanded) {
      stopCenterScroll();
      stopEdgeScroll();
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!items.some((item) => item.id === activeId)) {
      setActiveId(fallbackActiveId);
    }
  }, [activeId, fallbackActiveId, itemsSignature, items]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!activateOnScroll || !scroller || typeof window === "undefined") return;

    let scrollTimer = 0;

    const getCenteredCardId = () => {
      const scrollerRect = scroller.getBoundingClientRect();
      const scrollerCenter = scrollerRect.left + scrollerRect.width / 2;
      let nextActiveId = activeIdRef.current;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const [id, node] of cardRefs.current) {
        const rect = node.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(cardCenter - scrollerCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          nextActiveId = id;
        }
      }

      return nextActiveId;
    };

    const scheduleSettledActivation = () => {
      if (window.performance.now() < suppressScrollActivationUntilRef.current) return;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        if (window.performance.now() < suppressScrollActivationUntilRef.current) return;
        const nextActiveId = getCenteredCardId();
        setActiveId((current) => (current === nextActiveId ? current : nextActiveId));
      }, scrollActivationDelay);
    };

    scroller.addEventListener("scroll", scheduleSettledActivation, { passive: true });

    return () => {
      scroller.removeEventListener("scroll", scheduleSettledActivation);
      window.clearTimeout(scrollTimer);
    };
  }, [activateOnScroll, itemsSignature, scrollActivationDelay]);

  useEffect(() => () => {
    stopCenterScroll();
    stopEdgeScroll();
  }, []);

  const activateCard = (id: string) => {
    setActiveId(id);
    startCenterScroll(id);
  };

  const activateCardByIndex = (index: number) => {
    const item = items[index];
    if (!item) return;
    activateCard(item.id);
  };

  const stopEdgeScroll = () => {
    edgeScrollVelocityRef.current = 0;
    if (edgeScrollFrameRef.current && typeof window !== "undefined") {
      window.cancelAnimationFrame(edgeScrollFrameRef.current);
    }
    edgeScrollFrameRef.current = 0;
  };

  const getCenteredScrollLeft = (id: string) => {
    const scroller = scrollerRef.current;
    const card = cardRefs.current.get(id);
    if (!scroller || !card) return null;

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    if (maxScrollLeft <= 0) return 0;

    const scrollerRect = scroller.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const target =
      scroller.scrollLeft +
      cardRect.left -
      scrollerRect.left -
      (scroller.clientWidth - cardRect.width) / 2;

    return Math.max(0, Math.min(maxScrollLeft, target));
  };

  const stopCenterScroll = () => {
    centerScrollTargetIdRef.current = null;
    if (centerScrollFrameRef.current && typeof window !== "undefined") {
      window.cancelAnimationFrame(centerScrollFrameRef.current);
    }
    centerScrollFrameRef.current = 0;
  };

  const runCenterScroll = () => {
    const scroller = scrollerRef.current;
    const targetId = centerScrollTargetIdRef.current;
    if (!scroller || !targetId || isExpandedRef.current || typeof window === "undefined") {
      stopCenterScroll();
      return;
    }

    const target = getCenteredScrollLeft(targetId);
    if (target === null) {
      stopCenterScroll();
      return;
    }

    const distance = target - scroller.scrollLeft;
    if (Math.abs(distance) < 0.6) {
      scroller.scrollLeft = target;
    } else {
      scroller.scrollLeft += distance * 0.26;
    }

    const settled = Math.abs(target - scroller.scrollLeft) < 0.8;
    if (window.performance.now() >= centerScrollUntilRef.current && settled) {
      scroller.scrollLeft = target;
      stopCenterScroll();
      return;
    }

    centerScrollFrameRef.current = window.requestAnimationFrame(runCenterScroll);
  };

  const startCenterScroll = (id: string) => {
    if (typeof window === "undefined") return;
    stopEdgeScroll();
    centerScrollTargetIdRef.current = id;
    centerScrollUntilRef.current = window.performance.now() + 360;
    suppressScrollActivationUntilRef.current = window.performance.now() + 620;
    if (!centerScrollFrameRef.current) {
      centerScrollFrameRef.current = window.requestAnimationFrame(runCenterScroll);
    }
  };

  const runEdgeScroll = () => {
    const scroller = scrollerRef.current;
    const velocity = edgeScrollVelocityRef.current;
    if (!scroller || isExpandedRef.current || Math.abs(velocity) < 0.2 || typeof window === "undefined") {
      stopEdgeScroll();
      return;
    }

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    const before = scroller.scrollLeft;
    const next = Math.max(0, Math.min(maxScrollLeft, before + velocity));
    scroller.scrollLeft = next;

    if (next === before || (next <= 0 && velocity < 0) || (next >= maxScrollLeft && velocity > 0)) {
      stopEdgeScroll();
      return;
    }

    edgeScrollFrameRef.current = window.requestAnimationFrame(runEdgeScroll);
  };

  const startEdgeScroll = (velocity: number) => {
    stopCenterScroll();
    edgeScrollVelocityRef.current = velocity;
    if (!edgeScrollFrameRef.current && typeof window !== "undefined") {
      edgeScrollFrameRef.current = window.requestAnimationFrame(runEdgeScroll);
    }
  };

  const handleViewportPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isExpanded || event.pointerType !== "mouse" || typeof window === "undefined" || !window.matchMedia(EDGE_SCROLL_MEDIA_QUERY).matches) {
      stopEdgeScroll();
      return;
    }

    const scroller = scrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth + 1) {
      stopEdgeScroll();
      return;
    }

    const rect = scroller.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const edgeSize = Math.min(EDGE_SCROLL_ZONE, rect.width * 0.24);
    let velocity = 0;

    if (x < edgeSize) {
      const strength = (edgeSize - x) / edgeSize;
      velocity = -EDGE_SCROLL_MAX_SPEED * strength * strength;
    } else if (x > rect.width - edgeSize) {
      const strength = (x - (rect.width - edgeSize)) / edgeSize;
      velocity = EDGE_SCROLL_MAX_SPEED * strength * strength;
    }

    if (Math.abs(velocity) > 0.2) startEdgeScroll(velocity);
    else stopEdgeScroll();
  };

  const handleViewportWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (isExpanded) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;

    stopCenterScroll();
    stopEdgeScroll();

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    if (maxScrollLeft <= 0) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;

    const before = scroller.scrollLeft;
    const next = Math.max(0, Math.min(maxScrollLeft, before + delta));
    if (next === before) return;

    event.preventDefault();
    scroller.scrollLeft = next;
  };

  const setExpandedState = (nextExpanded: boolean) => {
    if (expanded === undefined) setUncontrolledExpanded(nextExpanded);
    onExpandedChange?.(nextExpanded);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activateCard(id);
  };

  return (
    <section className={cn("landing-section-rail", className)} data-expanded={isExpanded ? "true" : "false"} data-variant={variant}>
      <header className="landing-section-rail__header">
        <div className="landing-section-rail__title-group">
          {eyebrow ? <div className="landing-section-rail__eyebrow">{eyebrow}</div> : null}
          <h2 className="landing-section-rail__title">{title}</h2>
        </div>
      </header>

      <div
        className="landing-section-rail__viewport"
        data-expanded={isExpanded ? "true" : "false"}
        onPointerLeave={stopEdgeScroll}
        onPointerMove={handleViewportPointerMove}
        onWheel={handleViewportWheel}
        ref={scrollerRef}
        role="list"
        aria-label={railLabel}
      >
        {items.map((item, index) => {
          const active = !isExpanded && item.id === activeId;
          return (
            <article
              aria-current={active ? "true" : undefined}
              className="landing-section-rail__card"
              data-active={active ? "true" : "false"}
              data-landing-rail-card-id={item.id}
              key={item.id}
              onClick={() => activateCard(item.id)}
              onKeyDown={(event) => handleCardKeyDown(event, item.id)}
              ref={(node) => {
                if (node) cardRefs.current.set(item.id, node);
                else cardRefs.current.delete(item.id);
              }}
              role="listitem"
              tabIndex={0}
            >
              {renderItem({
                active,
                activate: () => activateCard(item.id),
                expanded: isExpanded,
                index,
                item,
              })}
            </article>
          );
        })}
      </div>

      {hasControls ? (
        <div className="landing-section-rail__controls" data-expanded={isExpanded ? "true" : "false"}>
          {items.length > 1 ? (
            <nav
              aria-label={`${railLabel ?? "Section"} carousel controls`}
              className="landing-section-rail__mobile-nav"
              data-expanded={isExpanded ? "true" : "false"}
            >
              <button aria-label="Previous card" disabled={!canGoPrev} onClick={() => activateCardByIndex(activeIndex - 1)} type="button">
                <span aria-hidden="true">←</span>
              </button>
              <span aria-label={`${activeIndex + 1} of ${items.length}`} aria-live="polite" className="landing-section-rail__mobile-progress">
                {items.map((item, index) => (
                  <i aria-hidden="true" data-active={index === activeIndex ? "true" : "false"} key={item.id} />
                ))}
              </span>
              <button aria-label="Next card" disabled={!canGoNext} onClick={() => activateCardByIndex(activeIndex + 1)} type="button">
                <span aria-hidden="true">→</span>
              </button>
            </nav>
          ) : null}

          {meta || expandable ? (
            <div className="landing-section-rail__side">
              {meta ? <div className="landing-section-rail__meta">{meta}</div> : null}
              {expandable ? (
                <button
                  aria-expanded={isExpanded}
                  className="landing-section-rail__expand"
                  onClick={() => setExpandedState(!isExpanded)}
                  type="button"
                >
                  {isExpanded ? collapseLabel : viewAllLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function LandingSectionRailCardFrame({
  active,
  className,
  ...props
}: ComponentProps<"div"> & { active?: boolean }) {
  return (
    <div
      className={cn("landing-section-rail-card-frame", className)}
      data-active={active ? "true" : "false"}
      {...props}
    />
  );
}
