/**
 * Section Rail Island — interactivity for the SSR-rendered LandingSectionRail.
 *
 * Vanilla JS, attaches to existing DOM (no React/hydration). Mirrors the React
 * component's stable dynamics:
 *   - centering via native `scrollTo({ behavior: "smooth" })` (no rAF that fights
 *     CSS scroll-snap);
 *   - active card detected with an IntersectionObserver centre band (no per-frame
 *     getBoundingClientRect polling);
 *   - no infinite-loop teleporting and no hover edge-scroll.
 */

const ACTIVE_LOCK_MS = 700;

type Props = {
	itemIds: string[];
	expandable: boolean;
	collapseLabel: string;
	viewAllLabel: string;
};

export function mount(
	container: HTMLElement,
	rawProps: Record<string, unknown>,
): void {
	const props = rawProps as Props;
	const itemIds: string[] = Array.isArray(props.itemIds) ? props.itemIds : [];

	const section =
		container.querySelector<HTMLElement>(".landing-section-rail") ?? container;
	const scroller = container.querySelector<HTMLElement>(
		".landing-section-rail__viewport",
	);
	if (!scroller) return;

	let activationLockUntil = 0;
	const isExpanded = () => section.dataset.expanded === "true";

	const allCards = () =>
		Array.from(
			scroller.querySelectorAll<HTMLElement>("[data-landing-rail-item-id]"),
		);

	const cardById = (id: string) =>
		scroller.querySelector<HTMLElement>(
			`[data-landing-rail-item-id="${CSS.escape(id)}"]`,
		);

	function getActiveId(): string {
		return (
			scroller.querySelector<HTMLElement>("[data-active='true']")?.dataset
				.landingRailItemId ??
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

	function syncDots(activeId: string) {
		const dots = container.querySelectorAll<HTMLElement>(
			".landing-section-rail__mobile-progress i",
		);
		const idx = itemIds.indexOf(activeId);
		dots.forEach((dot, i) => {
			dot.dataset.active = i === idx ? "true" : "false";
		});
	}

	function syncNavButtons() {
		const [prevBtn, nextBtn] = Array.from(
			container.querySelectorAll<HTMLButtonElement>(
				".landing-section-rail__mobile-nav button",
			),
		);
		if (!prevBtn || !nextBtn) return;
		const idx = getActiveIndex();
		prevBtn.disabled = idx <= 0;
		nextBtn.disabled = idx >= itemIds.length - 1;
	}

	function centerCard(id: string, behavior: ScrollBehavior) {
		const card = cardById(id);
		if (!card) return;
		const target =
			card.offsetLeft - (scroller.clientWidth - card.offsetWidth) / 2;
		const maxScroll = scroller.scrollWidth - scroller.clientWidth;
		const left = Math.max(0, Math.min(maxScroll, target));
		activationLockUntil = performance.now() + ACTIVE_LOCK_MS;
		scroller.scrollTo({ left, behavior });
	}

	function activate(id: string) {
		setActiveDom(id);
		if (!isExpanded()) centerCard(id, "smooth");
	}

	function activateByIndex(idx: number) {
		const clamped = Math.max(0, Math.min(itemIds.length - 1, idx));
		const id = itemIds[clamped];
		if (id) activate(id);
	}

	// ── Active detection (IntersectionObserver centre band) ───────────────────────

	const observer = new IntersectionObserver(
		(entries) => {
			if (isExpanded() || performance.now() < activationLockUntil) return;
			let bestId: string | null = null;
			let bestRatio = -1;
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				const id = (entry.target as HTMLElement).dataset.landingRailItemId;
				if (!id) continue;
				if (entry.intersectionRatio > bestRatio) {
					bestRatio = entry.intersectionRatio;
					bestId = id;
				}
			}
			if (bestId && bestId !== getActiveId()) setActiveDom(bestId);
		},
		{
			root: scroller,
			rootMargin: "0px -47% 0px -47%",
			threshold: [0, 0.25, 0.75, 1],
		},
	);
	for (const card of allCards()) observer.observe(card);

	// ── Interaction ───────────────────────────────────────────────────────────────

	scroller.addEventListener(
		"pointerdown",
		() => {
			activationLockUntil = 0;
		},
		{ passive: true },
	);

	scroller.addEventListener("click", (e) => {
		if (isExpanded()) return;
		const card = (e.target as HTMLElement).closest<HTMLElement>(
			"[data-landing-rail-item-id]",
		);
		const id = card?.dataset.landingRailItemId;
		if (id) activate(id);
	});

	scroller.addEventListener("keydown", (e) => {
		if (e.key !== "Enter" && e.key !== " ") return;
		const card = (e.target as HTMLElement).closest<HTMLElement>(
			"[data-landing-rail-item-id]",
		);
		const id = card?.dataset.landingRailItemId;
		if (!id) return;
		e.preventDefault();
		activate(id);
	});

	const navBtns = container.querySelectorAll<HTMLButtonElement>(
		".landing-section-rail__mobile-nav button",
	);
	if (navBtns.length >= 2) {
		navBtns[0].addEventListener("click", () =>
			activateByIndex(getActiveIndex() - 1),
		);
		navBtns[1].addEventListener("click", () =>
			activateByIndex(getActiveIndex() + 1),
		);
	}

	// Wheel → horizontal scroll (native handles the motion; no snap fight).
	scroller.addEventListener(
		"wheel",
		(e: WheelEvent) => {
			if (isExpanded()) return;
			const maxScroll = scroller.scrollWidth - scroller.clientWidth;
			if (maxScroll <= 0) return;
			const dx =
				Math.abs(e.deltaX) > Math.abs(e.deltaY)
					? e.deltaX
					: e.shiftKey
						? e.deltaY
						: 0;
			if (!dx) return;
			const before = scroller.scrollLeft;
			const next = Math.max(0, Math.min(maxScroll, before + dx));
			if (next === before) return;
			e.preventDefault();
			activationLockUntil = 0;
			scroller.scrollLeft = next;
		},
		{ passive: false },
	);

	// Expand / Collapse
	const expandBtn = container.querySelector<HTMLButtonElement>(
		".landing-section-rail__expand",
	);
	if (expandBtn) {
		expandBtn.addEventListener("click", () => {
			const next = !isExpanded();
			section.dataset.expanded = next ? "true" : "false";
			scroller.dataset.expanded = next ? "true" : "false";
			const ctrl = container.querySelector<HTMLElement>(
				".landing-section-rail__controls",
			);
			if (ctrl) ctrl.dataset.expanded = next ? "true" : "false";
			const nav = container.querySelector<HTMLElement>(
				".landing-section-rail__mobile-nav",
			);
			if (nav) nav.dataset.expanded = next ? "true" : "false";
			expandBtn.setAttribute("aria-expanded", next ? "true" : "false");
			expandBtn.textContent = next ? props.collapseLabel : props.viewAllLabel;
			if (!next) centerCard(getActiveId(), "auto");
		});
	}

	// Re-center on resize (no animation).
	let resizeTimer = 0;
	window.addEventListener(
		"resize",
		() => {
			clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(() => {
				if (!isExpanded()) centerCard(getActiveId(), "auto");
			}, 120);
		},
		{ passive: true },
	);

	// ── Init ──────────────────────────────────────────────────────────────────────
	// The row rests flush-left; the observer marks the card under the centre band
	// active. No initial centring (that would leave the leading half of the row
	// empty on wide screens).
	syncDots(getActiveId());
	syncNavButtons();
}
