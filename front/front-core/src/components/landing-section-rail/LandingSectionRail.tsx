import {
  useEffect,
  useLayoutEffect,
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
const LOOP_COPIES = [0, 1, 2, 3, 4] as const;
const LOOP_MIDDLE_COPY = 2;
const LOOP_KEY_SEPARATOR = "\u001e";
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function getLoopInstanceKey(copyIndex: number, id: string) {
  return `${copyIndex}${LOOP_KEY_SEPARATOR}${id}`;
}

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
  loop?: boolean;
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
  loop = false,
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
  const sectionRef = useRef<HTMLElement | null>(null);
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
  const canLoop = loop && items.length > 1;
  const isLooping = canLoop && !isExpanded;
  const canGoPrev = canLoop || activeIndex > 0;
  const canGoNext = canLoop || (activeIndex >= 0 && activeIndex < items.length - 1);
  const hasControls = items.length > 1 || Boolean(meta) || expandable;
  const renderedItems = isLooping
    ? LOOP_COPIES.flatMap((copyIndex) =>
        items.map((item, index) => ({
          copyIndex,
          index,
          instanceKey: getLoopInstanceKey(copyIndex, item.id),
          item,
        })),
      )
    : items.map((item, index) => ({
        copyIndex: LOOP_MIDDLE_COPY,
        index,
        instanceKey: item.id,
        item,
      }));

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

      for (const node of cardRefs.current.values()) {
        const id = node.dataset.landingRailItemId;
        if (!id) continue;
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
      normalizeLoopScroll();
      updateActiveAlignment();
      if (window.performance.now() < suppressScrollActivationUntilRef.current) return;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        normalizeLoopScroll();
        updateActiveAlignment();
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
  }, [activateOnScroll, isLooping, itemsSignature, scrollActivationDelay]);

  useEffect(() => () => {
    stopCenterScroll();
    stopEdgeScroll();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    updateActiveAlignment();
    window.addEventListener("resize", updateActiveAlignment);
    return () => window.removeEventListener("resize", updateActiveAlignment);
  }, [activeId, isExpanded, itemsSignature]);

  const activateCard = (id: string) => {
    setActiveId(id);
    startCenterScroll(id);
  };

  const activateCardByIndex = (index: number) => {
    const normalizedIndex = canLoop
      ? (index + items.length) % items.length
      : index;
    const item = items[normalizedIndex];
    if (!item) return;
    activateCard(item.id);
  };

  const updateActiveAlignment = () => {
    if (typeof window === "undefined") return;

    const section = sectionRef.current;
    if (section && isExpandedRef.current) {
      section.style.setProperty("--landing-rail-active-inset", "0px");
      section.style.setProperty("--landing-rail-active-width", "var(--landing-rail-card-active-width)");
      return;
    }

    const activeCard = getNearestCardForId(activeIdRef.current);
    if (!section || !activeCard) return;

    const sectionRect = section.getBoundingClientRect();
    const cardRect = activeCard.getBoundingClientRect();
    const sectionStyles = window.getComputedStyle(section);
    const sectionPaddingLeft = Number.parseFloat(sectionStyles.paddingLeft) || 0;
    const activeInset = Math.max(0, cardRect.left - sectionRect.left - sectionPaddingLeft);

    section.style.setProperty("--landing-rail-active-inset", `${activeInset}px`);
    section.style.setProperty("--landing-rail-active-width", `${cardRect.width}px`);
  };

  const getLoopMetrics = () => {
    if (!isLooping || items.length === 0) return null;

    const firstId = items[0]?.id;
    if (!firstId) return null;

    const previousCopy = cardRefs.current.get(getLoopInstanceKey(LOOP_MIDDLE_COPY - 1, firstId));
    const middleCopy = cardRefs.current.get(getLoopInstanceKey(LOOP_MIDDLE_COPY, firstId));
    if (!previousCopy || !middleCopy) return null;

    const span = middleCopy.offsetLeft - previousCopy.offsetLeft;
    if (span <= 0) return null;

    return {
      middleStart: middleCopy.offsetLeft,
      span,
    };
  };

  const normalizeLoopScroll = () => {
    const scroller = scrollerRef.current;
    const metrics = getLoopMetrics();
    if (!scroller || !metrics) return false;

    const lowerBound = metrics.middleStart - metrics.span * 0.5;
    const upperBound = metrics.middleStart + metrics.span * 0.5;

    if (scroller.scrollLeft < lowerBound) {
      scroller.scrollLeft += metrics.span;
      return true;
    }

    if (scroller.scrollLeft > upperBound) {
      scroller.scrollLeft -= metrics.span;
      return true;
    }

    return false;
  };

  const getNearestCardForId = (id: string) => {
    const scroller = scrollerRef.current;
    if (!scroller) return null;

    const scrollerRect = scroller.getBoundingClientRect();
    const scrollerCenter = scrollerRect.left + scrollerRect.width / 2;
    let nearestCard: HTMLElement | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const node of cardRefs.current.values()) {
      if (node.dataset.landingRailItemId !== id) continue;

      const rect = node.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distance = Math.abs(cardCenter - scrollerCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        nearestCard = node;
      }
    }

    return nearestCard;
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
    const card = getNearestCardForId(id);
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

  useIsomorphicLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!isLooping || !scroller) return;

    const metrics = getLoopMetrics();
    if (!metrics) return;

    scroller.scrollLeft = metrics.middleStart;
    const centeredActiveCard = getCenteredScrollLeft(activeIdRef.current);
    if (centeredActiveCard !== null) scroller.scrollLeft = centeredActiveCard;
    normalizeLoopScroll();
    updateActiveAlignment();
  }, [isLooping, itemsSignature]);

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
    normalizeLoopScroll();
    updateActiveAlignment();

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
    const normalized = normalizeLoopScroll();
    updateActiveAlignment();

    if (
      (!isLooping && (next === before || (next <= 0 && velocity < 0) || (next >= maxScrollLeft && velocity > 0))) ||
      (isLooping && next === before && !normalized)
    ) {
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
    normalizeLoopScroll();

    const horizontalDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0;
    const shiftWheelDelta =
      event.shiftKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)
        ? event.deltaY
        : 0;
    const delta = horizontalDelta || shiftWheelDelta;
    if (!delta) return;

    const before = scroller.scrollLeft;
    const next = Math.max(0, Math.min(maxScrollLeft, before + delta));
    if (next === before) return;

    event.preventDefault();
    scroller.scrollLeft = next;
    normalizeLoopScroll();
    updateActiveAlignment();
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
    <section
      className={cn("landing-section-rail", className)}
      data-expanded={isExpanded ? "true" : "false"}
      data-variant={variant}
      ref={sectionRef}
    >
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
        {renderedItems.map(({ copyIndex, index, instanceKey, item }) => {
          const active = !isExpanded && item.id === activeId;
          return (
            <article
              aria-current={active ? "true" : undefined}
              aria-hidden={isLooping && copyIndex !== LOOP_MIDDLE_COPY ? true : undefined}
              className="landing-section-rail__card"
              data-active={active ? "true" : "false"}
              data-landing-rail-card-id={item.id}
              data-landing-rail-copy={copyIndex}
              data-landing-rail-index={index}
              data-landing-rail-item-id={item.id}
              key={instanceKey}
              onClick={() => activateCard(item.id)}
              onKeyDown={(event) => handleCardKeyDown(event, item.id)}
              ref={(node) => {
                if (node) cardRefs.current.set(instanceKey, node);
                else cardRefs.current.delete(instanceKey);
              }}
              role="listitem"
              tabIndex={isLooping && copyIndex !== LOOP_MIDDLE_COPY ? -1 : 0}
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
