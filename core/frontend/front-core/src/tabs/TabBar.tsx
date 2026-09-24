import { useUnit } from "effector-preact";
import type { ComponentChildren, RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { ChevronDown, X } from "../icons";
import { CatalogMenu, type CatalogMenuText } from "./CatalogMenu";
import { ChoiceList } from "./ChoiceMenu";
import { useDismiss } from "./dismiss";
import { Floating } from "./floating";
import type { TabView } from "./model";
import { TabIcon } from "./TabIcon";
import { PushPin } from "./PushPin";
import type { TabBarModel } from "./tab-bar";

/**
 * How a bar looks, never how it behaves: `strip` is the top-level row of
 * surfaces, `bar` the row inside a surface, `list` the vertical navigation
 * the phone gets instead of both.
 */
export type TabBarTheme = "strip" | "bar" | "list";

export type TabBarText = CatalogMenuText & {
	/** Accessible name of the tab list. */
	tabs: string;
	close: (title: string) => string;
};

/** Roughly `.shell-menu-list` min-width, used to keep the menu on screen. */
const MENU_WIDTH = 210;

function Tab({
	tab,
	model,
	text,
	menuOpen,
}: {
	tab: TabView;
	model: TabBarModel;
	text: TabBarText;
	menuOpen: boolean;
}) {
	const { opened, pinToggled, closed, openedAt } = useUnit({
		opened: model.opened,
		pinToggled: model.pinToggled,
		closed: model.closed,
		openedAt: model.context.openedAt,
	});
	const pinLabel = tab.pinned ? text.unpin(tab.label) : text.pin(tab.label);

	return (
		<div
			class="tab"
			data-tab-id={tab.id}
			data-kind={tab.kind}
			data-active={tab.active ? "true" : undefined}
			data-pinned={tab.pinned ? "true" : undefined}
			data-menu-open={menuOpen ? "true" : undefined}
			role="presentation"
		>
			<button
				type="button"
				class="tab-select"
				// A command is a button in the row, not a tab: it is never selected.
				{...(tab.kind === "command"
					? {}
					: { role: "tab", "aria-selected": tab.active })}
				title={tab.description ?? tab.label}
				onClick={() => opened(tab.id)}
				onContextMenu={(event) => {
					event.preventDefault();
					openedAt({ id: tab.id, x: event.clientX, y: event.clientY });
				}}
				onAuxClick={(event) => {
					if (event.button !== 1 || tab.kind === "command") return;
					event.preventDefault();
					closed(tab.id);
				}}
			>
				<TabIcon name={tab.icon} kind={tab.kind} />
				<span class="tab-label">{tab.label}</span>
			</button>
			<span class="tab-actions">
				<button
					type="button"
					class="tab-pin"
					aria-label={pinLabel}
					title={pinLabel}
					aria-pressed={tab.pinned}
					onClick={() => pinToggled(tab.id)}
				>
					<PushPin size={11} />
				</button>
				{tab.kind === "command" ? null : (
					<button
						type="button"
						class="tab-close"
						aria-label={text.close(tab.label)}
						title={text.close(tab.label)}
						onClick={() => closed(tab.id)}
					>
						<X size={11} aria-hidden="true" />
					</button>
				)}
			</span>
		</div>
	);
}

function TabContextMenu({
	model,
	anchor,
}: {
	model: TabBarModel;
	anchor: RefObject<HTMLElement | null>;
}) {
	const { target, actions, closed, chosen } = useUnit({
		target: model.context.$target,
		actions: model.$actions,
		closed: model.context.closed,
		chosen: model.context.chosen,
	});
	const ref = useRef<HTMLDivElement>(null);
	useDismiss(ref, target !== null, closed);

	const items = target ? actions[target.id] : undefined;
	if (!target || !items?.length) return null;
	return (
		<Floating anchor={anchor}>
			<div class="shell-menu-anchor" ref={ref}>
				<ChoiceList
					items={items}
					align="start"
					style={{
						position: "fixed",
						zIndex: 1000,
						top: `${target.y}px`,
						left: `${Math.max(8, Math.min(target.x, window.innerWidth - MENU_WIDTH))}px`,
					}}
					onChoose={chosen}
				/>
			</div>
		</Floating>
	);
}

/**
 * Any tabbed place: what is pinned, the one transient tab, and the catalog menu
 * with everything else. Every behaviour lives in the model; the theme only
 * decides how it looks.
 */
export function TabBar({
	model,
	theme,
	text,
	children,
}: {
	model: TabBarModel;
	theme: TabBarTheme;
	text: TabBarText;
	/** Rendered after the catalog button: controls that belong to the bar. */
	children?: ComponentChildren;
}) {
	const { tabs, active, target, pinToggled } = useUnit({
		tabs: model.$tabs,
		active: model.$active,
		target: model.context.$target,
		pinToggled: model.pinToggled,
	});
	const rootRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	// Whatever became active — from the catalog menu, the assistant, a restored URL
	// — has to be in the visible part of the row.
	useEffect(() => {
		if (!active) return;
		listRef.current
			?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(active)}"]`)
			?.scrollIntoView({ inline: "nearest", block: "nearest" });
	}, [active]);

	return (
		<div class="tabs" data-theme={theme} ref={rootRef}>
			<div
				class="tabs-list"
				role="tablist"
				aria-label={text.tabs}
				aria-orientation={theme === "list" ? "vertical" : "horizontal"}
				ref={listRef}
			>
				{tabs.map((tab) => (
					<Tab
						key={tab.id}
						tab={tab}
						model={model}
						text={text}
						menuOpen={target?.id === tab.id}
					/>
				))}
			</div>
			<CatalogMenu
				model={model.add}
				onPinToggle={pinToggled}
				text={text}
				align={theme === "list" ? "end" : "start"}
				// Not "+": choosing a row replaces the unpinned tab rather than
				// adding one, and a plus promised the opposite.
				trigger={<ChevronDown size={14} aria-hidden="true" />}
			/>
			{children}
			<TabContextMenu model={model} anchor={rootRef} />
		</div>
	);
}
