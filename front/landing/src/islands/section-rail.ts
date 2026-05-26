/**
 * Section Rail Island — vanilla JS interactivity for SSR-rendered LandingSectionRail.
 * Attaches to existing DOM, no React/hydration.
 */

const SCROLL_SETTLE_MS = 240;
const LOOP_MIDDLE_COPY = 2;
const CENTER_SCROLL_EASE = 0.26;
const CENTER_SCROLL_DURATION_MS = 520;
const CENTER_SCROLL_THRESHOLD = 0.8;
const EDGE_ZONE = 112;
const EDGE_MAX_SPEED = 18;

type Props = {
  itemIds: string[];
  loop: boolean;
  expandable: boolean;
  collapseLabel: string;
  viewAllLabel: string;
};

export function mount(container: HTMLElement, rawProps: Record<string, unknown>): void {
  const props = rawProps as Props;
  const itemIds: string[] = Array.isArray(props.itemIds) ? props.itemIds : [];
  const isLoop = () =>
    props.loop &&
    section.dataset.expanded !== "true" &&
    container.querySelectorAll("[data-landing-rail-copy]").length > itemIds.length;

  const section = container.querySelector<HTMLElement>(".landing-section-rail") ?? container;
  const scrollerElement = container.querySelector<HTMLElement>(".landing-section-rail__viewport");
  if (!scrollerElement) return;
  const scroller = scrollerElement;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const allCards = () =>
    Array.from(scroller.querySelectorAll<HTMLElement>("[data-landing-rail-item-id]"));

  const middleCards = () =>
    allCards().filter(c => c.dataset.landingRailCopy === String(LOOP_MIDDLE_COPY));

  function getActiveId(): string {
    return (
      scroller.querySelector<HTMLElement>("[data-active='true']")?.dataset.landingRailItemId ??
      itemIds[0] ??
      ""
    );
  }

  function getActiveIndex(): number {
    return Math.max(0, itemIds.indexOf(getActiveId()));
  }

  function setActiveDom(id: string) {
    for (const card of allCards()) {
      const active = card.dataset.landingRailItemId === id;
      card.dataset.active = active ? "true" : "false";
      card
        .querySelectorAll<HTMLElement>(
          ".landing-section-rail-card-frame, .landing-section-rail-block-machine-photo",
        )
        .forEach((node) => {
          node.dataset.active = active ? "true" : "false";
        });
      if (active) card.setAttribute("aria-current", "true");
      else card.removeAttribute("aria-current");
    }
    syncDots(id);
    syncNavButtons();
  }

  // ── Pagination dots ───────────────────────────────────────────────────────────

  function syncDots(activeId: string) {
    const dots = container.querySelectorAll<HTMLElement>(
      ".landing-section-rail__mobile-progress i"
    );
    const idx = itemIds.indexOf(activeId);
    dots.forEach((dot, i) => { dot.dataset.active = i === idx ? "true" : "false"; });
  }

  // ── Prev/Next button state ────────────────────────────────────────────────────

  function syncNavButtons() {
    const [prevBtn, nextBtn] = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".landing-section-rail__mobile-nav button")
    );
    if (!prevBtn || !nextBtn) return;
    const idx = getActiveIndex();
    prevBtn.disabled = !props.loop && idx <= 0;
    nextBtn.disabled = !props.loop && idx >= itemIds.length - 1;
  }

  // ── Smooth center-scroll ─────────────────────────────────────────────────────

  let centerRaf = 0;
  let centerTarget: string | null = null;
  let centerUntil = 0;

  function stopCenter() {
    centerTarget = null;
    cancelAnimationFrame(centerRaf);
    centerRaf = 0;
  }

  function targetScrollLeft(id: string): number | null {
    const cards = isLoop() ? middleCards() : allCards();
    const card = cards.find(c => c.dataset.landingRailItemId === id);
    if (!card) return null;
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    if (maxScroll <= 0) return 0;
    const sr = scroller.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const t = scroller.scrollLeft + cr.left - sr.left - (scroller.clientWidth - cr.width) / 2;
    return Math.max(0, Math.min(maxScroll, t));
  }

  function runCenter() {
    if (!centerTarget || section.dataset.expanded === "true") { stopCenter(); return; }
    const t = targetScrollLeft(centerTarget);
    if (t === null) { stopCenter(); return; }
    const dist = t - scroller.scrollLeft;
    if (Math.abs(dist) < CENTER_SCROLL_THRESHOLD && performance.now() >= centerUntil) {
      scroller.scrollLeft = t; stopCenter(); return;
    }
    scroller.scrollLeft += dist * CENTER_SCROLL_EASE;
    if (isLoop()) normalizeLoop();
    centerRaf = requestAnimationFrame(runCenter);
  }

  function centerTo(id: string) {
    stopEdge();
    centerTarget = id;
    centerUntil = performance.now() + CENTER_SCROLL_DURATION_MS;
    cancelAnimationFrame(centerRaf);
    centerRaf = requestAnimationFrame(runCenter);
  }

  // ── Loop normalization ────────────────────────────────────────────────────────

  function normalizeLoop() {
    const copyWidth = scroller.scrollWidth / 5;
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    if (scroller.scrollLeft < copyWidth * 0.5) {
      scroller.scrollLeft += copyWidth * 2;
    } else if (scroller.scrollLeft > maxScroll - copyWidth * 0.5) {
      scroller.scrollLeft -= copyWidth * 2;
    }
  }

  // ── Edge scroll ───────────────────────────────────────────────────────────────

  let edgeRaf = 0;
  let edgeVelocity = 0;

  function stopEdge() { edgeVelocity = 0; cancelAnimationFrame(edgeRaf); edgeRaf = 0; }

  function runEdge() {
    if (Math.abs(edgeVelocity) < 0.1) { stopEdge(); return; }
    scroller.scrollLeft += edgeVelocity;
    if (isLoop()) normalizeLoop();
    edgeRaf = requestAnimationFrame(runEdge);
  }

  function startEdge(v: number) {
    edgeVelocity = v;
    if (!edgeRaf) edgeRaf = requestAnimationFrame(runEdge);
  }

  // ── Activate ──────────────────────────────────────────────────────────────────

  function activate(id: string, scroll = true) {
    setActiveDom(id);
    if (scroll && section.dataset.expanded !== "true") centerTo(id);
  }

  function activateByIndex(idx: number) {
    const wrapped = props.loop
      ? ((idx % itemIds.length) + itemIds.length) % itemIds.length
      : Math.max(0, Math.min(itemIds.length - 1, idx));
    const id = itemIds[wrapped];
    if (id) activate(id);
  }

  // ── Centered card detection ───────────────────────────────────────────────────

  function centeredId(): string | null {
    const cx = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
    const cards = isLoop() ? middleCards() : allCards();
    let best: string | null = null;
    let bestDist = Infinity;
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - cx);
      if (d < bestDist) { bestDist = d; best = card.dataset.landingRailItemId ?? null; }
    }
    return best;
  }

  // ── Event listeners ───────────────────────────────────────────────────────────

  // Click on card
  scroller.addEventListener("click", (e) => {
    if (section.dataset.expanded === "true") return;
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-landing-rail-item-id]");
    if (!card) return;
    const id = card.dataset.landingRailItemId;
    if (id) activate(id);
  });

  // Keyboard on card
  scroller.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-landing-rail-item-id]");
    if (!card) return;
    e.preventDefault();
    const id = card.dataset.landingRailItemId;
    if (id) activate(id);
  });

  // Prev / Next buttons
  const navBtns = container.querySelectorAll<HTMLButtonElement>(
    ".landing-section-rail__mobile-nav button"
  );
  if (navBtns.length >= 2) {
    navBtns[0].addEventListener("click", () => activateByIndex(getActiveIndex() - 1));
    navBtns[1].addEventListener("click", () => activateByIndex(getActiveIndex() + 1));
  }

  // Scroll → activate centered
  let scrollTimer = 0;
  scroller.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      if (isLoop()) normalizeLoop();
      const id = centeredId();
      if (id) setActiveDom(id);
    }, SCROLL_SETTLE_MS);
  }, { passive: true });

  // Wheel → horizontal scroll
  scroller.addEventListener("wheel", (e: WheelEvent) => {
    if (section.dataset.expanded === "true") return;
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    if (maxScroll <= 0) return;
    const dx =
      Math.abs(e.deltaX) > Math.abs(e.deltaY)
        ? e.deltaX
        : e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)
          ? e.deltaY
          : 0;
    if (!dx) return;
    e.preventDefault();
    stopCenter();
    scroller.scrollLeft = Math.max(0, Math.min(maxScroll, scroller.scrollLeft + dx));
    if (isLoop()) normalizeLoop();
  }, { passive: false });

  // Edge scroll on hover
  const mq = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 761px)");
  scroller.addEventListener("pointermove", (e: PointerEvent) => {
    if (!mq.matches || section.dataset.expanded === "true") { stopEdge(); return; }
    const rect = scroller.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const rightDist = rect.width - x;
    if (x < EDGE_ZONE) {
      startEdge(-(1 - (x / EDGE_ZONE) ** 2) * EDGE_MAX_SPEED);
    } else if (rightDist < EDGE_ZONE) {
      startEdge((1 - (rightDist / EDGE_ZONE) ** 2) * EDGE_MAX_SPEED);
    } else {
      stopEdge();
    }
  });
  scroller.addEventListener("pointerleave", stopEdge);

  // Expand / Collapse button
  const expandBtn = container.querySelector<HTMLButtonElement>(".landing-section-rail__expand");
  if (expandBtn) {
    expandBtn.addEventListener("click", () => {
      const next = section.dataset.expanded !== "true";
      section.dataset.expanded = next ? "true" : "false";
      scroller.dataset.expanded = next ? "true" : "false";
      const ctrl = container.querySelector<HTMLElement>(".landing-section-rail__controls");
      if (ctrl) ctrl.dataset.expanded = next ? "true" : "false";
      const nav = container.querySelector<HTMLElement>(".landing-section-rail__mobile-nav");
      if (nav) nav.dataset.expanded = next ? "true" : "false";
      expandBtn.setAttribute("aria-expanded", next ? "true" : "false");
      expandBtn.textContent = next ? props.collapseLabel : props.viewAllLabel;
      if (!next) {
        const id = getActiveId();
        if (id) centerTo(id);
      }
    });
  }

  // Resize → re-center active
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const id = getActiveId();
      if (id && section.dataset.expanded !== "true") {
        const t = targetScrollLeft(id);
        if (t !== null) scroller.scrollLeft = t;
      }
    }, 100);
  }, { passive: true });

  // ── Init ──────────────────────────────────────────────────────────────────────

  if (isLoop()) normalizeLoop();
  const initId = getActiveId();
  if (initId) {
    const t = targetScrollLeft(initId);
    if (t !== null) scroller.scrollLeft = t;
  }
  syncDots(initId);
  syncNavButtons();
}
