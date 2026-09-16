import { useUnit } from "effector-preact";
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef } from "preact/hooks";
import { Pin, Plus } from "../icons";
import { useDismiss } from "./dismiss";
import { Floating, useAnchoredPosition } from "./floating";
import type { CatalogMenu as CatalogMenuModel } from "./menus";
import type { CatalogEntry } from "./model";
import { TabIcon } from "./TabIcon";

export type CatalogMenuText = {
	/** Trigger label and the list's accessible name. */
	label: string;
	search: string;
	empty: string;
	/** One line over the list saying what choosing a row does. */
	hint?: string;
	pin: (title: string) => string;
	unpin: (title: string) => string;
};

const PANEL_WIDTH = 360;

/**
 * A catalog behind a button: everything a place could show, searchable, with a
 * pin on every row. What choosing does belongs to the place — a tab bar opens
 * the row as its transient tab, the home screen adds it — so the trigger and
 * the hint are the caller's, not this component's.
 */
export function CatalogMenu({
	model,
	onPinToggle,
	text,
	align = "start",
	trigger,
}: {
	model: CatalogMenuModel<CatalogEntry>;
	onPinToggle: (id: string) => void;
	text: CatalogMenuText;
	align?: "start" | "end";
	trigger?: ComponentChildren;
}) {
	const units = useUnit({
		open: model.$open,
		query: model.$query,
		visible: model.$visible,
		highlight: model.$highlight,
		toggled: model.toggled,
		closed: model.closed,
		queryChanged: model.queryChanged,
		highlightMoved: model.highlightMoved,
		highlightSet: model.highlightSet,
		confirmed: model.confirmed,
		chosen: model.chosen,
	});
	const anchorRef = useRef<HTMLDivElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const refs = useMemo(() => [anchorRef, panelRef], []);
	useDismiss(refs, units.open, units.closed);
	const position = useAnchoredPosition(
		anchorRef,
		units.open,
		align,
		PANEL_WIDTH,
	);

	useEffect(() => {
		if (!units.open) return;
		listRef.current
			?.querySelector<HTMLElement>(`[data-index="${units.highlight}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [units.open, units.highlight]);

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			units.highlightMoved(event.key === "ArrowDown" ? 1 : -1);
		} else if (event.key === "Enter") {
			event.preventDefault();
			units.confirmed();
		}
	};

	let group: string | undefined;

	return (
		<div class="catalog-menu" ref={anchorRef}>
			<button
				type="button"
				class="catalog-menu-trigger"
				aria-label={text.label}
				title={text.label}
				aria-haspopup="dialog"
				aria-expanded={units.open}
				onClick={() => units.toggled()}
			>
				{trigger ?? <Plus size={14} aria-hidden="true" />}
			</button>
			{units.open ? (
				<Floating anchor={anchorRef}>
					<div
						class="catalog-menu-panel"
						role="dialog"
						aria-label={text.label}
						ref={panelRef}
						// Hidden for the one frame before the anchor has been measured.
						style={
							position.position
								? position
								: { position: "fixed", visibility: "hidden" }
						}
					>
						<input
							class="catalog-menu-search"
							type="search"
							placeholder={text.search}
							aria-label={text.search}
							value={units.query}
							// biome-ignore lint/a11y/noAutofocus: the list opened to be searched
							autoFocus
							onInput={(event) =>
								units.queryChanged((event.target as HTMLInputElement).value)
							}
							onKeyDown={onKeyDown}
						/>
						{text.hint ? <p class="catalog-menu-hint">{text.hint}</p> : null}
						{units.visible.length === 0 ? (
							<p class="catalog-menu-empty">{text.empty}</p>
						) : (
							<ul
								class="catalog-menu-list"
								aria-label={text.label}
								ref={listRef}
							>
								{units.visible.map((entry, index) => {
									const heading =
										entry.group && entry.group !== group ? entry.group : null;
									group = entry.group;
									const pinLabel = entry.pinned
										? text.unpin(entry.label)
										: text.pin(entry.label);
									return [
										heading ? (
											<li key={`group:${heading}`} class="catalog-menu-group">
												{heading}
											</li>
										) : null,
										<li
											key={entry.id}
											class="catalog-menu-row"
											data-highlighted={
												index === units.highlight ? "true" : undefined
											}
											data-index={index}
											data-open={entry.open ? "true" : undefined}
											data-active={entry.active ? "true" : undefined}
											data-kind={entry.kind}
											onPointerMove={() =>
												index === units.highlight
													? undefined
													: units.highlightSet(index)
											}
										>
											<button
												type="button"
												class="catalog-menu-choose"
												onClick={() => units.chosen(entry.id)}
											>
												<TabIcon name={entry.icon} kind={entry.kind} />
												<span class="catalog-menu-label">{entry.label}</span>
												{entry.description ? (
													<span class="catalog-menu-description">
														{entry.description}
													</span>
												) : null}
											</button>
											<button
												type="button"
												class="catalog-menu-pin"
												aria-pressed={entry.pinned}
												aria-label={pinLabel}
												title={pinLabel}
												onClick={() => onPinToggle(entry.id)}
											>
												<Pin size={12} aria-hidden="true" />
											</button>
										</li>,
									];
								})}
							</ul>
						)}
					</div>
				</Floating>
			) : null}
		</div>
	);
}
