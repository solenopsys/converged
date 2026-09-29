import { useUnit } from "effector-preact";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { ChevronDown, Trash2 } from "../icons";
import { CatalogMenu, type CatalogMenuText } from "./CatalogMenu";
import type { TabView } from "./model";
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

function Tab({
	tab,
	model,
	text,
	href,
}: {
	tab: TabView;
	model: TabBarModel;
	text: TabBarText;
	href?: string;
}) {
	const { opened, pinToggled, closed } = useUnit({
		opened: model.opened,
		pinToggled: model.pinToggled,
		closed: model.closed,
	});
	const canClose = tab.kind !== "command";
	const actionLabel = tab.pinned
		? canClose
			? text.close(tab.label)
			: text.unpin(tab.label)
		: text.pin(tab.label);

	return (
		<div
			class="tab"
			data-tab-id={tab.id}
			data-kind={tab.kind}
			data-active={tab.active ? "true" : undefined}
			data-pinned={tab.pinned ? "true" : undefined}
			role="presentation"
		>
			{href && tab.kind !== "command" ? (
				<a
					href={href}
					class="tab-select"
					role="tab"
					aria-selected={tab.active}
					title={tab.description ?? tab.label}
					onClick={(event) => {
						if (
							event.button !== 0 ||
							event.metaKey ||
							event.ctrlKey ||
							event.shiftKey ||
							event.altKey
						)
							return;
						event.preventDefault();
						opened(tab.id);
					}}
				>
					<span class="tab-label">{tab.label}</span>
				</a>
			) : (
				<button
					type="button"
					class="tab-select"
					// A command is a button in the row, not a tab: it is never selected.
					{...(tab.kind === "command"
						? {}
						: { role: "tab", "aria-selected": tab.active })}
					title={tab.description ?? tab.label}
					onClick={() => opened(tab.id)}
					onAuxClick={(event) => {
						if (event.button !== 1 || tab.kind === "command") return;
						event.preventDefault();
						closed(tab.id);
					}}
				>
					<span class="tab-label">{tab.label}</span>
				</button>
			)}
			<span class="tab-actions">
				<button
					type="button"
					class="tab-action"
					aria-label={actionLabel}
					title={actionLabel}
					onClick={(event) => {
						event.stopPropagation();
						if (tab.pinned && canClose) closed(tab.id);
						else pinToggled(tab.id);
					}}
				>
					{tab.pinned && canClose ? (
						<Trash2 size={11} aria-hidden="true" />
					) : (
						<PushPin size={11} pinned={tab.pinned} />
					)}
				</button>
			</span>
		</div>
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
	hrefForTab,
	children,
}: {
	model: TabBarModel;
	theme: TabBarTheme;
	text: TabBarText;
	/** Optional real destinations for tabs, enabling browser link behavior. */
	hrefForTab?: (tab: TabView) => string | undefined;
	/** Rendered after the catalog button: controls that belong to the bar. */
	children?: ComponentChildren;
}) {
	const { tabs, active, pinToggled } = useUnit({
		tabs: model.$tabs,
		active: model.$active,
		pinToggled: model.pinToggled,
	});
	const listRef = useRef<HTMLDivElement>(null);
	const catalogMenu = (
		<CatalogMenu
			model={model.add}
			onPinToggle={pinToggled}
			text={text}
			align={theme === "list" ? "end" : "start"}
			trigger={<ChevronDown size={14} aria-hidden="true" />}
		/>
	);

	// Whatever became active — from the catalog menu, the assistant, a restored URL
	// — has to be in the visible part of the row.
	useEffect(() => {
		if (!active) return;
		listRef.current
			?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(active)}"]`)
			?.scrollIntoView({ inline: "nearest", block: "nearest" });
	}, [active]);

	return (
		<div class="tabs" data-theme={theme}>
			<div
				class="tabs-list"
				role="tablist"
				aria-label={text.tabs}
				aria-orientation={theme === "list" ? "vertical" : "horizontal"}
				ref={listRef}
			>
				{tabs.map((tab: TabView) => (
					<Tab
						key={tab.id}
						tab={tab}
						model={model}
						text={text}
						href={hrefForTab?.(tab)}
					/>
				))}
			</div>
			{catalogMenu}
			{children}
		</div>
	);
}
