import { combine, createStore, type Event, type Store, sample } from "effector";
import type { StreamlineIcon } from "../icons";
import {
	type CatalogMenu,
	type ContextMenu,
	createCatalogMenu,
	createContextMenu,
} from "./menus";
import type { CatalogEntry, TabView } from "./model";
import type { TabSetUnits } from "./tab-set";

export type ActionItem = {
	id: string;
	label: string;
	icon?: StreamlineIcon;
	danger?: boolean;
	checked?: boolean;
};

/** Extra right-click actions for a tab, beyond pin and close. */
export type TabActionsOf = (tab: TabView) => ActionItem[];

/**
 * Everything one rendered tab bar needs. The tab set is the place; the bar is
 * one way of drawing it, so a place drawn twice (the top strip and the mobile
 * navigation) gets two bars over one set — each with its own catalog menu open
 * state, never with its own tabs.
 */
export type TabBarModel = TabSetUnits & {
	add: CatalogMenu<CatalogEntry>;
	context: ContextMenu;
	/** Right-click actions per visible tab, pin and close first. */
	$actions: Store<Readonly<Record<string, ActionItem[]>>>;
	/** Actions that are neither pin nor close, for the owner to run. */
	actionInvoked: Event<{ id: string; actionId: string }>;
};

export const PIN_ACTION = "pin";
export const CLOSE_ACTION = "close";

type TabBarConfig = {
	name: string;
	set: TabSetUnits;
	/** Labels for the built-in actions, resolved by the caller's catalog. */
	labels: (tab: TabView) => { pin: string; unpin: string; close: string };
	icons?: {
		pin?: ActionItem["icon"];
		unpin?: ActionItem["icon"];
		close?: ActionItem["icon"];
	};
	$extraActions?: Store<TabActionsOf>;
};

const NO_EXTRA: TabActionsOf = () => [];

export function createTabBar({
	name,
	set,
	labels,
	icons = {},
	$extraActions = createStore<TabActionsOf>(NO_EXTRA, {
		name: `${name}_NO_EXTRA_ACTIONS`,
	}),
}: TabBarConfig): TabBarModel {
	const add = createCatalogMenu({ name: `${name}_ADD`, $items: set.$entries });
	sample({ clock: add.chosen, target: set.opened });

	const context = createContextMenu(`${name}_CONTEXT`);
	sample({
		clock: context.invoked,
		filter: ({ actionId }) => actionId === PIN_ACTION,
		fn: ({ id }) => id,
		target: set.pinToggled,
	});
	sample({
		clock: context.invoked,
		filter: ({ actionId }) => actionId === CLOSE_ACTION,
		fn: ({ id }) => id,
		target: set.closed,
	});
	const actionInvoked = context.invoked.filter({
		fn: ({ actionId }) => actionId !== PIN_ACTION && actionId !== CLOSE_ACTION,
	});

	const $actions = combine(set.$tabs, $extraActions, (tabs, extra) =>
		Object.fromEntries(
			tabs.map((tab) => {
				const text = labels(tab);
				const pinIcon = tab.pinned ? icons.unpin : icons.pin;
				const base: ActionItem[] = [
					{
						id: PIN_ACTION,
						label: tab.pinned ? text.unpin : text.pin,
						...(pinIcon ? { icon: pinIcon } : {}),
					},
					...(tab.kind === "command"
						? []
						: [
								{
									id: CLOSE_ACTION,
									label: text.close,
									...(icons.close ? { icon: icons.close } : {}),
								},
							]),
				];
				return [tab.id, [...base, ...extra(tab)]];
			}),
		),
	);

	return { ...set, add, context, $actions, actionInvoked };
}
