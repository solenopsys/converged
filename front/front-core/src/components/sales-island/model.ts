/**
 * Sales Island — UI state.
 *
 * The expanded/collapsed state is owned by an effector store. A factory is used
 * (instead of a module-level singleton) so every island instance — each React
 * mount and each hydrated SSR island — gets its own isolated state, which keeps
 * Storybook stories and multi-island pages from cross-talking.
 *
 * Both rendering paths share this model:
 *   - the React component reads it via `useUnit($open)`;
 *   - the vanilla hydration island calls the events and watches `$open` to drive
 *     the DOM directly.
 */

import {
	createEvent,
	createStore,
	type EventCallable,
	type Store,
} from "effector";

export type SalesIslandModel = {
	$open: Store<boolean>;
	opened: EventCallable<void>;
	closed: EventCallable<void>;
	toggled: EventCallable<void>;
};

export function createSalesIslandModel(
	defaultExpanded = false,
): SalesIslandModel {
	const opened = createEvent();
	const closed = createEvent();
	const toggled = createEvent();

	const $open = createStore<boolean>(defaultExpanded)
		.on(opened, () => true)
		.on(closed, () => false)
		.on(toggled, (open) => !open);

	return { $open, opened, closed, toggled };
}
