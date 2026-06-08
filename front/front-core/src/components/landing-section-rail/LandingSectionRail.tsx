import {
	type ComponentProps,
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
	type WheelEvent,
} from "react";
import { cn } from "../../lib/utils";

/**
 * Horizontal "focus" carousel: the centered card is marked active (enlarged +
 * highlighted via CSS). Stability notes — the dynamics are intentionally kept
 * simple to avoid the feedback loops that made earlier versions jitter:
 *
 *   - Centering uses native `scrollTo({ behavior: "smooth" })`, never a custom
 *     rAF loop that fights CSS scroll-snap.
 *   - The active card is detected with an IntersectionObserver center band, not
 *     per-frame getBoundingClientRect polling (no forced reflows).
 *   - No infinite-loop scroll teleporting and no hover edge-scroll — both were
 *     major sources of position jumps.
 */

const ACTIVE_LOCK_MS = 700;
// Resting inset of the active (left-aligned) card from the viewport's left edge.
const RAIL_INSET = 16;
const SCROLL_SETTLE_MS = 120;

export type LandingSectionRailBaseItem = {
	id: string;
};

export type LandingSectionRailRenderState<
	TItem extends LandingSectionRailBaseItem,
> = {
	active: boolean;
	activate: () => void;
	expanded: boolean;
	index: number;
	item: TItem;
};

export type LandingSectionRailProps<TItem extends LandingSectionRailBaseItem> =
	{
		activateOnScroll?: boolean;
		className?: string;
		collapseLabel?: ReactNode;
		defaultExpanded?: boolean;
		eyebrow?: ReactNode;
		expandable?: boolean;
		expanded?: boolean;
		initialActiveId?: string;
		items: TItem[];
		/** @deprecated kept for API compatibility; the rail no longer loops. */
		loop?: boolean;
		meta?: ReactNode;
		onExpandedChange?: (expanded: boolean) => void;
		railLabel?: string;
		renderItem: (state: LandingSectionRailRenderState<TItem>) => ReactNode;
		/** @deprecated kept for API compatibility; activation is observer-driven. */
		scrollActivationDelay?: number;
		title: ReactNode;
		viewAllLabel?: ReactNode;
		variant?: "default" | "compact" | "immersive";
	};

export function LandingSectionRail<TItem extends LandingSectionRailBaseItem>(
	props: LandingSectionRailProps<TItem>,
) {
	if (typeof window === "undefined") {
		return <LandingSectionRailStatic {...props} />;
	}
	return <LandingSectionRailInteractive {...props} />;
}

function LandingSectionRailInteractive<
	TItem extends LandingSectionRailBaseItem,
>({
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
	title,
	viewAllLabel = "View all",
	variant = "default",
}: LandingSectionRailProps<TItem>) {
	const fallbackActiveId = initialActiveId ?? items[0]?.id ?? "";
	const [activeId, setActiveId] = useState(fallbackActiveId);
	const [uncontrolledExpanded, setUncontrolledExpanded] =
		useState(defaultExpanded);
	const isExpanded = expanded ?? uncontrolledExpanded;

	const sectionRef = useRef<HTMLElement | null>(null);
	const scrollerRef = useRef<HTMLDivElement | null>(null);
	const cardRefs = useRef(new Map<string, HTMLElement>());
	const isExpandedRef = useRef(isExpanded);
	// While a programmatic scroll is in flight we ignore observer activations so
	// the target card cannot be "stolen" by a card it passes over on the way.
	const activationLockUntilRef = useRef(0);

	const itemsSignature = items.map((item) => item.id).join("");
	const activeIndex = Math.max(
		0,
		items.findIndex((item) => item.id === activeId),
	);
	const hasControls = items.length > 1 || Boolean(meta) || expandable;

	useEffect(() => {
		isExpandedRef.current = isExpanded;
	}, [isExpanded]);

	useEffect(() => {
		if (!items.some((item) => item.id === activeId)) {
			setActiveId(fallbackActiveId);
		}
	}, [activeId, fallbackActiveId, items]);

	// Align a card to the left edge (with the small inset).
	const scrollCardToStart = (id: string, behavior: ScrollBehavior) => {
		const scroller = scrollerRef.current;
		const card = cardRefs.current.get(id);
		if (!scroller || !card) return;

		const rel =
			card.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
		const target = scroller.scrollLeft + rel - RAIL_INSET;
		const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
		const left = Math.max(0, Math.min(maxScrollLeft, target));

		activationLockUntilRef.current = window.performance.now() + ACTIVE_LOCK_MS;
		scroller.scrollTo({ left, behavior });
	};

	// The active card is the left-most one (closest to the resting inset).
	const leftmostCardId = (): string | null => {
		const scroller = scrollerRef.current;
		if (!scroller) return null;
		const scrollerLeft = scroller.getBoundingClientRect().left;
		let bestId: string | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const [id, node] of cardRefs.current) {
			const rel = node.getBoundingClientRect().left - scrollerLeft;
			const distance = Math.abs(rel - RAIL_INSET);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestId = id;
			}
		}
		return bestId;
	};

	const activateCard = (id: string) => {
		setActiveId(id);
		if (!isExpandedRef.current) scrollCardToStart(id, "smooth");
	};

	const activateCardByIndex = (index: number) => {
		const normalizedIndex = Math.max(0, Math.min(items.length - 1, index));
		const item = items[normalizedIndex];
		if (item) activateCard(item.id);
	};

	// Active = the left-most card. Updated only after a scroll settles, so the
	// initial first-card active state (matching SSR) never flickers on load — the
	// first card simply stays active until the user actually scrolls.
	useEffect(() => {
		const scroller = scrollerRef.current;
		if (!activateOnScroll || !scroller || isExpanded) return;

		let timer = 0;
		const onScroll = () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => {
				if (window.performance.now() < activationLockUntilRef.current) return;
				const id = leftmostCardId();
				if (id) setActiveId((current) => (current === id ? current : id));
			}, SCROLL_SETTLE_MS);
		};

		scroller.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			scroller.removeEventListener("scroll", onScroll);
			window.clearTimeout(timer);
		};
	}, [activateOnScroll, isExpanded, itemsSignature]);

	// Release the activation lock once the user starts scrolling by hand, so a
	// manual drag immediately re-enables observer-driven activation.
	useEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		const onPointerDown = () => {
			activationLockUntilRef.current = 0;
		};
		scroller.addEventListener("pointerdown", onPointerDown, { passive: true });
		return () => scroller.removeEventListener("pointerdown", onPointerDown);
	}, []);

	const setExpandedState = (nextExpanded: boolean) => {
		if (expanded === undefined) setUncontrolledExpanded(nextExpanded);
		onExpandedChange?.(nextExpanded);
	};

	// Translate vertical wheel / shift-wheel into horizontal scroll so a mouse
	// wheel can move the rail. Native scroll handles the rest.
	const handleViewportWheel = (event: WheelEvent<HTMLDivElement>) => {
		if (isExpanded) return;
		const scroller = scrollerRef.current;
		if (!scroller) return;

		const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
		if (maxScrollLeft <= 0) return;

		const delta =
			Math.abs(event.deltaX) > Math.abs(event.deltaY)
				? event.deltaX
				: event.shiftKey
					? event.deltaY
					: 0;
		if (!delta) return;

		const before = scroller.scrollLeft;
		const next = Math.max(0, Math.min(maxScrollLeft, before + delta));
		if (next === before) return;

		event.preventDefault();
		activationLockUntilRef.current = 0;
		scroller.scrollLeft = next;
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
					{eyebrow ? (
						<div className="landing-section-rail__eyebrow">{eyebrow}</div>
					) : null}
					<h2 className="landing-section-rail__title">{title}</h2>
				</div>
			</header>

			<div
				className="landing-section-rail__viewport"
				data-expanded={isExpanded ? "true" : "false"}
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
							data-landing-rail-index={index}
							data-landing-rail-item-id={item.id}
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
				<div
					className="landing-section-rail__controls"
					data-expanded={isExpanded ? "true" : "false"}
				>
					{items.length > 1 ? (
						<nav
							aria-label={`${railLabel ?? "Section"} carousel controls`}
							className="landing-section-rail__mobile-nav"
							data-expanded={isExpanded ? "true" : "false"}
						>
							<button
								aria-label="Previous card"
								disabled={activeIndex <= 0}
								onClick={() => activateCardByIndex(activeIndex - 1)}
								type="button"
							>
								<span aria-hidden="true">←</span>
							</button>
							<span
								aria-label={`${activeIndex + 1} of ${items.length}`}
								aria-live="polite"
								className="landing-section-rail__mobile-progress"
							>
								{items.map((item, index) => (
									<i
										aria-hidden="true"
										data-active={index === activeIndex ? "true" : "false"}
										key={item.id}
									/>
								))}
							</span>
							<button
								aria-label="Next card"
								disabled={activeIndex >= items.length - 1}
								onClick={() => activateCardByIndex(activeIndex + 1)}
								type="button"
							>
								<span aria-hidden="true">→</span>
							</button>
						</nav>
					) : null}

					{meta || expandable ? (
						<div className="landing-section-rail__side">
							{meta ? (
								<div className="landing-section-rail__meta">{meta}</div>
							) : null}
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

function LandingSectionRailStatic<TItem extends LandingSectionRailBaseItem>({
	className,
	collapseLabel = "Collapse",
	defaultExpanded = false,
	eyebrow,
	expandable = false,
	expanded,
	initialActiveId,
	items,
	meta,
	railLabel,
	renderItem,
	title,
	viewAllLabel = "View all",
	variant = "default",
}: LandingSectionRailProps<TItem>) {
	const fallbackActiveId = initialActiveId ?? items[0]?.id ?? "";
	const isExpanded = expanded ?? defaultExpanded;
	const activeIndex = Math.max(
		0,
		items.findIndex((item) => item.id === fallbackActiveId),
	);
	const hasControls = items.length > 1 || Boolean(meta) || expandable;

	return (
		<section
			className={cn("landing-section-rail", className)}
			data-expanded={isExpanded ? "true" : "false"}
			data-variant={variant}
		>
			<header className="landing-section-rail__header">
				<div className="landing-section-rail__title-group">
					{eyebrow ? (
						<div className="landing-section-rail__eyebrow">{eyebrow}</div>
					) : null}
					<h2 className="landing-section-rail__title">{title}</h2>
				</div>
			</header>

			<div
				className="landing-section-rail__viewport"
				data-expanded={isExpanded ? "true" : "false"}
				role="list"
				aria-label={railLabel}
			>
				{items.map((item, index) => {
					const active = !isExpanded && item.id === fallbackActiveId;
					return (
						<article
							aria-current={active ? "true" : undefined}
							className="landing-section-rail__card"
							data-active={active ? "true" : "false"}
							data-landing-rail-index={index}
							data-landing-rail-item-id={item.id}
							key={item.id}
							role="listitem"
							tabIndex={0}
						>
							{renderItem({
								active,
								activate: () => undefined,
								expanded: isExpanded,
								index,
								item,
							})}
						</article>
					);
				})}
			</div>

			{hasControls ? (
				<div
					className="landing-section-rail__controls"
					data-expanded={isExpanded ? "true" : "false"}
				>
					{items.length > 1 ? (
						<nav
							aria-label={`${railLabel ?? "Section"} carousel controls`}
							className="landing-section-rail__mobile-nav"
							data-expanded={isExpanded ? "true" : "false"}
						>
							<button
								aria-label="Previous card"
								disabled={activeIndex <= 0}
								type="button"
							>
								<span aria-hidden="true">←</span>
							</button>
							<span
								aria-label={`${activeIndex + 1} of ${items.length}`}
								aria-live="polite"
								className="landing-section-rail__mobile-progress"
							>
								{items.map((item, index) => (
									<i
										aria-hidden="true"
										data-active={index === activeIndex ? "true" : "false"}
										key={item.id}
									/>
								))}
							</span>
							<button
								aria-label="Next card"
								disabled={activeIndex >= items.length - 1}
								type="button"
							>
								<span aria-hidden="true">→</span>
							</button>
						</nav>
					) : null}

					{meta || expandable ? (
						<div className="landing-section-rail__side">
							{meta ? (
								<div className="landing-section-rail__meta">{meta}</div>
							) : null}
							{expandable ? (
								<button
									aria-expanded={isExpanded}
									className="landing-section-rail__expand"
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
