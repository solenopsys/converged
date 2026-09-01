import { translator } from "i18n";
import type { RefObject } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { CHAT_MESSAGES_NAMESPACE } from "../chat/i18n";
import { ChevronDown, Pin, X } from "../icons";
import { type ActionMenuItem, ActionMenuList } from "./ActionMenu";
import { usePopover } from "./popover";

const t = translator(CHAT_MESSAGES_NAMESPACE);

export type TopBarTab = {
	key: string;
	title: string;
	pinned: boolean;
	active: boolean;
	actions: ActionMenuItem[];
};

type TabHandlers = {
	onSelect?: (key: string) => void;
	onClose?: (key: string) => void;
	onPinToggle?: (key: string) => void;
	onAction?: (key: string, actionId: string) => void;
};

type ContextAnchor = { key: string; x: number; y: number };

/** Roughly `.shell-menu-list` min-width, used to keep the menu on screen. */
const MENU_WIDTH = 210;


/**
 * Keys of tabs the single-row strip cannot show in full. Driven by
 * IntersectionObserver against the scroller so it re-settles on resize, on
 * scroll and on tab churn without any manual measuring.
 */
function useHiddenTabs(
	scrollerRef: RefObject<HTMLDivElement | null>,
	tabs: TopBarTab[],
): Set<string> {
	const [hidden, setHidden] = useState<Set<string>>(() => new Set());
	const signature = tabs.map((tab) => tab.key).join(" ");

	useEffect(() => {
		const root = scrollerRef.current;
		if (!root || typeof IntersectionObserver === "undefined") return;

		setHidden(new Set());

		const observer = new IntersectionObserver(
			(entries) => {
				setHidden((current) => {
					const next = new Set(current);
					for (const entry of entries) {
						const key = (entry.target as HTMLElement).dataset.tabKey;
						if (!key) continue;
						// A tab wider than the strip can never reach ratio 1; treat any
						// meaningful sliver of it as visible instead of hiding it forever.
						const rootWidth = entry.rootBounds?.width ?? 0;
						const oversized =
							rootWidth > 0 && entry.boundingClientRect.width >= rootWidth;
						if (
							entry.intersectionRatio >= 0.99 ||
							(entry.isIntersecting && oversized)
						) {
							next.delete(key);
						} else {
							next.add(key);
						}
					}
					return next;
				});
			},
			{ root, threshold: [0, 0.99, 1] },
		);

		for (const element of root.querySelectorAll<HTMLElement>("[data-tab-key]")) {
			observer.observe(element);
		}

		return () => observer.disconnect();
	}, [signature, scrollerRef]);

	return hidden;
}


function TabItem({
	tab,
	onSelect,
	onClose,
	onPinToggle,
	onContextMenu,
	menuOpen,
}: {
	tab: TopBarTab;
	onContextMenu: (anchor: ContextAnchor) => void;
	menuOpen: boolean;
} & Omit<TabHandlers, "onAction">) {
	const pinLabel = tab.pinned ? t("tab.unpinTab") : t("tab.pinTab");

	return (
		<div
			class="top-bar-tab"
			data-tab-key={tab.key}
			data-active={tab.active ? "true" : undefined}
			data-pinned={tab.pinned ? "true" : undefined}
			data-menu-open={menuOpen ? "true" : undefined}
			role="presentation"
		>
			<button
				type="button"
				class="top-bar-tab-select"
				role="tab"
				aria-selected={tab.active}
				title={tab.title}
				onClick={() => onSelect?.(tab.key)}
				onContextMenu={(event) => {
					if (tab.actions.length === 0) return;
					event.preventDefault();
					onContextMenu({ key: tab.key, x: event.clientX, y: event.clientY });
				}}
				onAuxClick={(event) => {
					if (!onClose) return;
					if (event.button !== 1) return;
					event.preventDefault();
					onClose?.(tab.key);
				}}
			>
				<span>{tab.title}</span>
			</button>
			{onPinToggle || onClose ? (
				<span class="top-bar-tab-actions">
					{onPinToggle ? (
						<button
							type="button"
							class="top-bar-tab-pin"
							aria-label={`${pinLabel}: ${tab.title}`}
							title={pinLabel}
							aria-pressed={tab.pinned}
							onClick={() => onPinToggle(tab.key)}
						>
							<Pin size={11} aria-hidden="true" />
						</button>
					) : null}
					{onClose ? (
						<button
							type="button"
							class="top-bar-tab-close"
							aria-label={t("tab.closeNamed", { title: tab.title })}
							title={t("tab.closeTab")}
							onClick={() => onClose(tab.key)}
						>
							<X size={11} aria-hidden="true" />
						</button>
					) : null}
				</span>
			) : null}
		</div>
	);
}


function OverflowMenu({
	tabs,
	label,
	onSelect,
	onClose,
}: {
	tabs: TopBarTab[];
	label: string;
} & Pick<TabHandlers, "onSelect" | "onClose">) {
	const { ref, open, setOpen } = usePopover<HTMLDivElement>();

	return (
		<div class="shell-menu top-bar-tab-overflow" ref={ref}>
			<button
				type="button"
				class="shell-menu-trigger"
				aria-label={t("tab.hiddenCount", { label, count: tabs.length })}
				title={t("tab.hiddenTabs", { count: tabs.length })}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				<ChevronDown size={13} aria-hidden="true" />
				<span class="top-bar-tab-overflow-count">{tabs.length}</span>
			</button>
			{open ? (
				<div class="shell-menu-list" role="menu" data-align="end">
					{tabs.map((tab) => (
						<div key={tab.key} class="top-bar-overflow-row" role="none">
							<button
								type="button"
								role="menuitem"
								class="top-bar-overflow-select"
								data-active={tab.active ? "true" : undefined}
								onClick={() => {
									setOpen(false);
									onSelect?.(tab.key);
								}}
							>
								<Pin
									size={12}
									class="shell-menu-icon top-bar-overflow-pin"
									data-pinned={tab.pinned ? "true" : undefined}
								/>
								<span>{tab.title}</span>
							</button>
							{onClose ? (
								<button
									type="button"
									class="top-bar-tab-close"
									aria-label={t("tab.closeNamed", { title: tab.title })}
									title={t("tab.closeTab")}
									onClick={() => onClose(tab.key)}
								>
									<X size={11} aria-hidden="true" />
								</button>
							) : null}
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}


/**
 * Single-row workspace tab strip: hover-revealed pin/close on each tab, the
 * full action list on right-click, and everything that does not fit collected
 * into an overflow menu.
 */
export function TabStrip({
	tabs,
	label,
	onSelect,
	onClose,
	onPinToggle,
	onAction,
}: { tabs: TopBarTab[]; label: string } & TabHandlers) {
	const scrollerRef = useRef<HTMLDivElement | null>(null);
	const hidden = useHiddenTabs(scrollerRef, tabs);
	const menu = usePopover<HTMLDivElement>();
	const [anchor, setAnchor] = useState<ContextAnchor | null>(null);

	const activeKey = tabs.find((tab) => tab.active)?.key ?? null;
	const overflow = useMemo(
		() => tabs.filter((tab) => hidden.has(tab.key)),
		[tabs, hidden],
	);
	const contextTab = menu.open
		? (tabs.find((tab) => tab.key === anchor?.key) ?? null)
		: null;

	// Activating a tab from the overflow menu (or from a command) has to bring
	// it back into the visible part of the strip.
	useEffect(() => {
		if (!activeKey) return;
		scrollerRef.current
			?.querySelector<HTMLElement>(`[data-tab-key="${CSS.escape(activeKey)}"]`)
			?.scrollIntoView({ inline: "nearest", block: "nearest" });
	}, [activeKey]);

	return (
		<div class="top-bar-tabstrip">
			<div
				class="top-bar-tabs"
				aria-label={label}
				role="tablist"
				ref={scrollerRef}
			>
				{tabs.map((tab) => (
					<TabItem
						key={tab.key}
						tab={tab}
						menuOpen={contextTab?.key === tab.key}
						onSelect={onSelect}
						onClose={onClose}
						onPinToggle={onPinToggle}
						onContextMenu={(next) => {
							setAnchor(next);
							menu.setOpen(true);
						}}
					/>
				))}
			</div>

			{overflow.length > 0 ? (
				<OverflowMenu
					tabs={overflow}
					label={label}
					onSelect={onSelect}
					onClose={onClose}
				/>
			) : null}

			<div class="shell-menu-anchor" ref={menu.ref}>
				{contextTab && anchor ? (
					<ActionMenuList
						items={contextTab.actions}
						align="start"
						style={{
							position: "fixed",
							top: `${anchor.y}px`,
							left: `${Math.max(8, Math.min(anchor.x, window.innerWidth - MENU_WIDTH))}px`,
						}}
						onSelect={(actionId) => {
							menu.setOpen(false);
							onAction?.(contextTab.key, actionId);
						}}
					/>
				) : null}
			</div>
		</div>
	);
}
