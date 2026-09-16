import {
	combine,
	createEvent,
	createStore,
	type Event,
	type EventCallable,
	type Store,
	sample,
} from "effector";
import { type CatalogItem, matchesQuery } from "./model";

// Dropdowns as state, not as component hooks.
//
// Whether a menu is open, what is typed into its search and which row the
// keyboard is on are facts the rest of the shell may care about — the
// assistant closing a menu it opened, a test choosing a row. So they are
// effector units created next to the model that owns the menu; the component
// only reports DOM events (outside click, key presses) and draws.

export type Dropdown = {
	$open: Store<boolean>;
	opened: EventCallable<void>;
	closed: EventCallable<void>;
	toggled: EventCallable<void>;
};

export function createDropdown(name: string): Dropdown {
	const opened = createEvent(`${name}_OPENED`);
	const closed = createEvent(`${name}_CLOSED`);
	const toggled = createEvent(`${name}_TOGGLED`);
	const $open = createStore(false, { name: `${name}_OPEN` })
		.on(opened, () => true)
		.on(closed, () => false)
		.on(toggled, (open) => !open);
	return { $open, opened, closed, toggled };
}

/** A dropdown whose rows are fixed actions: a language list, a tab's menu. */
export type ChoiceMenu = Dropdown & {
	chosen: EventCallable<string>;
};

export function createChoiceMenu(name: string): ChoiceMenu {
	const dropdown = createDropdown(name);
	const chosen = createEvent<string>(`${name}_CHOSEN`);
	sample({ clock: chosen, target: dropdown.closed });
	return { ...dropdown, chosen };
}

export type ContextTarget = { id: string; x: number; y: number };

/** A choice menu opened at a point, for one item of a list. */
export type ContextMenu = {
	$target: Store<ContextTarget | null>;
	openedAt: EventCallable<ContextTarget>;
	closed: EventCallable<void>;
	chosen: EventCallable<string>;
	/** The chosen action together with the item it was chosen for. */
	invoked: Event<{ id: string; actionId: string }>;
};

export function createContextMenu(name: string): ContextMenu {
	const openedAt = createEvent<ContextTarget>(`${name}_OPENED_AT`);
	const closed = createEvent(`${name}_CLOSED`);
	const chosen = createEvent<string>(`${name}_CHOSEN`);
	const $target = createStore<ContextTarget | null>(null, {
		name: `${name}_TARGET`,
	})
		.on(openedAt, (_, target) => target)
		.reset(closed);
	const invoked = sample({
		clock: chosen,
		source: $target,
		filter: (target): target is ContextTarget => target !== null,
		fn: (target, actionId) => ({ id: (target as ContextTarget).id, actionId }),
	});
	sample({ clock: chosen, target: closed });
	return { $target, openedAt, closed, chosen, invoked };
}

/**
 * The catalog menu: search, keyboard highlight, choice. Rows keep
 * the catalog's order; filtering never reorders them, so a row does not jump
 * while the user is aiming at it.
 */
export type CatalogMenu<T extends CatalogItem> = Dropdown & {
	$query: Store<string>;
	$visible: Store<T[]>;
	$highlight: Store<number>;
	queryChanged: EventCallable<string>;
	/** +1 / -1, wrapping. */
	highlightMoved: EventCallable<number>;
	highlightSet: EventCallable<number>;
	/** Enter: choose the highlighted row. */
	confirmed: EventCallable<void>;
	chosen: EventCallable<string>;
};

export function createCatalogMenu<T extends CatalogItem>({
	name,
	$items,
}: {
	name: string;
	$items: Store<readonly T[]>;
}): CatalogMenu<T> {
	const dropdown = createDropdown(name);
	const queryChanged = createEvent<string>(`${name}_QUERY_CHANGED`);
	const highlightMoved = createEvent<number>(`${name}_HIGHLIGHT_MOVED`);
	const highlightSet = createEvent<number>(`${name}_HIGHLIGHT_SET`);
	const confirmed = createEvent(`${name}_CONFIRMED`);
	const chosen = createEvent<string>(`${name}_CHOSEN`);

	const $closedNow = dropdown.$open.updates.filter({ fn: (open) => !open });

	const $query = createStore("", { name: `${name}_QUERY` })
		.on(queryChanged, (_, query) => query)
		// A menu reopened later starts from the whole catalog again.
		.reset($closedNow);

	const $visible = combine($items, $query, (items, query) =>
		items.filter((item) => matchesQuery(item, query)),
	);

	const $highlight = createStore(0, { name: `${name}_HIGHLIGHT` })
		.on(highlightSet, (_, index) => index)
		.reset(queryChanged, $closedNow);

	sample({
		clock: highlightMoved,
		source: { index: $highlight, visible: $visible },
		filter: ({ visible }) => visible.length > 0,
		fn: ({ index, visible }, delta) =>
			(index + delta + visible.length) % visible.length,
		target: highlightSet,
	});

	sample({
		clock: confirmed,
		source: { index: $highlight, visible: $visible },
		filter: ({ index, visible }) => Boolean(visible[index]),
		fn: ({ index, visible }) => (visible[index] as T).id,
		target: chosen,
	});

	sample({ clock: chosen, target: dropdown.closed });

	return {
		...dropdown,
		$query,
		$visible,
		$highlight,
		queryChanged,
		highlightMoved,
		highlightSet,
		confirmed,
		chosen,
	};
}
