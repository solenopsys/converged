// The one rule every tabbed place in the interface follows, as pure functions.
//
// A place shows what the user pinned, plus at most one thing that is open but
// not pinned — the transient tab. Opening something else replaces the
// transient tab instead of adding one. Everything that *could* be opened lives
// in the catalog, which is behind the "+" button and nowhere else.
//
// The top strip (surfaces), the bar inside a surface (projections, records and
// commands) and the home board (statistic sections) are this rule with
// different catalogs and different looks. Keeping it free of effector and of
// the DOM is what lets all three share it and lets the tests read like the
// rule itself.

export type TabKind = "tab" | "command";

export type CatalogItem = {
	id: string;
	label: string;
	description?: string;
	/** Heading the "+" menu files the item under. */
	group?: string;
	/** A command runs when chosen; it is never the active tab. */
	kind?: TabKind;
	/** Icon name, resolved by whoever renders the item. */
	icon?: string;
	/** Configuration's suggestion; the user's own pin overrides it. */
	pinned?: boolean;
};

/** Something opened that no catalog lists: a record, a filtered set. */
export type TabEntry = {
	id: string;
	label: string;
	icon?: string;
};

/**
 * What is persisted: overrides of the catalog's suggestions. `unpinned` only
 * means something for an item the catalog pins by default.
 */
export type PinLayout = {
	pinned: string[];
	unpinned: string[];
};

export type TabSetState = {
	/** The user's overrides, on top of `CatalogItem.pinned`. */
	pins: Readonly<Record<string, boolean>>;
	/** Ids the user pinned, in the order they were pinned. */
	order: readonly string[];
	transient: string | null;
	active: string | null;
	/** Labels of open things the catalog does not list. */
	entries: Readonly<Record<string, TabEntry>>;
};

export type TabSetOptions = {
	/**
	 * Whether opening an unpinned item makes it transient. A board with no
	 * notion of "just looking" (the home screen) pins what is opened instead.
	 */
	transient: boolean;
	/** Where the place returns to when the active tab goes away. */
	home: string | null;
};

export type TabView = {
	id: string;
	label: string;
	description?: string;
	icon?: string;
	kind: TabKind;
	pinned: boolean;
	active: boolean;
};

export type CatalogEntry = CatalogItem & {
	kind: TabKind;
	pinned: boolean;
	/** On screen right now, pinned or transient. */
	open: boolean;
	active: boolean;
};

/** Result of one transition; the effector layer turns the flags into events. */
export type TabStep = {
	state: TabSetState;
	/** Left the screen and is forgotten: whatever it held can be released. */
	evicted: string[];
	/** A command was chosen; nothing about the place changed. */
	command: string | null;
	/** The pins changed, so the layout is worth saving. */
	pinsChanged: boolean;
};

export const emptyTabSet: TabSetState = {
	pins: {},
	order: [],
	transient: null,
	active: null,
	entries: {},
};

export const defaultTabSetOptions: TabSetOptions = {
	transient: true,
	home: null,
};

type Catalog = readonly CatalogItem[];

const itemOf = (catalog: Catalog, id: string): CatalogItem | undefined =>
	catalog.find((item) => item.id === id);

export function isPinned(
	state: TabSetState,
	catalog: Catalog,
	id: string,
): boolean {
	return state.pins[id] ?? itemOf(catalog, id)?.pinned ?? false;
}

/** Pinned ids in display order: configuration's first, then the user's. */
export function pinnedIds(state: TabSetState, catalog: Catalog): string[] {
	const suggested = catalog
		.filter((item) => item.pinned && state.pins[item.id] !== false)
		.map((item) => item.id);
	const chosen = new Set(suggested);
	const own = [
		...state.order,
		// A layout restored without an order still has to show its pins.
		...Object.keys(state.pins).filter((id) => !state.order.includes(id)),
	].filter((id) => state.pins[id] === true && !chosen.has(id));
	return [...suggested, ...new Set(own)];
}

/**
 * A pin the catalog cannot name is kept, not shown: a solution installed later
 * brings its surface back into the strip exactly where the user left it.
 */
function resolvable(state: TabSetState, catalog: Catalog, id: string): boolean {
	return Boolean(itemOf(catalog, id) ?? state.entries[id]);
}

export function visibleIds(state: TabSetState, catalog: Catalog): string[] {
	const pinned = pinnedIds(state, catalog).filter((id) =>
		resolvable(state, catalog, id),
	);
	const transient = state.transient;
	return transient &&
		!pinned.includes(transient) &&
		resolvable(state, catalog, transient)
		? [...pinned, transient]
		: pinned;
}

export function tabViews(state: TabSetState, catalog: Catalog): TabView[] {
	return visibleIds(state, catalog).map((id) => {
		const item = itemOf(catalog, id);
		const entry = state.entries[id];
		return {
			id,
			label: item?.label ?? entry?.label ?? id,
			...(item?.description ? { description: item.description } : {}),
			...((item?.icon ?? entry?.icon)
				? { icon: item?.icon ?? entry?.icon }
				: {}),
			kind: item?.kind ?? "tab",
			pinned: isPinned(state, catalog, id),
			active: state.active === id,
		};
	});
}

export function catalogEntries(
	state: TabSetState,
	catalog: Catalog,
): CatalogEntry[] {
	const open = new Set(visibleIds(state, catalog));
	return catalog.map((item) => ({
		...item,
		kind: item.kind ?? "tab",
		pinned: isPinned(state, catalog, item.id),
		open: open.has(item.id),
		active: state.active === item.id,
	}));
}

function step(state: TabSetState, patch: Partial<TabStep> = {}): TabStep {
	return {
		state,
		evicted: [],
		command: null,
		pinsChanged: false,
		...patch,
	};
}

function withoutEntries(
	entries: TabSetState["entries"],
	ids: readonly string[],
): TabSetState["entries"] {
	if (!ids.some((id) => id in entries)) return entries;
	const next = { ...entries };
	for (const id of ids) delete next[id];
	return next;
}

function pin(state: TabSetState, id: string): TabSetState {
	return {
		...state,
		pins: { ...state.pins, [id]: true },
		order: [...state.order.filter((entry) => entry !== id), id],
		transient: state.transient === id ? null : state.transient,
	};
}

function unpin(state: TabSetState, catalog: Catalog, id: string): TabSetState {
	const { [id]: _removed, ...pins } = state.pins;
	return {
		...state,
		// Unpinning something configuration pins has to be remembered as such,
		// or the next reload pins it again.
		pins: itemOf(catalog, id)?.pinned ? { ...pins, [id]: false } : pins,
		order: state.order.filter((entry) => entry !== id),
	};
}

/** Where the active tab goes when it leaves: home, else the last one left. */
function fallback(
	state: TabSetState,
	catalog: Catalog,
	options: TabSetOptions,
	leaving: string,
): string | null {
	const left = visibleIds(state, catalog).filter((id) => id !== leaving);
	if (options.home && options.home !== leaving) {
		if (left.includes(options.home) || itemOf(catalog, options.home))
			return options.home;
	}
	return left.at(-1) ?? null;
}

/**
 * Opens an item — a click on its tab, a choice in the "+" menu, something the
 * assistant presented. Opening what is already on screen only activates it.
 */
export function openTab(
	state: TabSetState,
	catalog: Catalog,
	id: string,
	entry: TabEntry | undefined,
	options: TabSetOptions,
): TabStep {
	const item = itemOf(catalog, id);
	if (item?.kind === "command") return step(state, { command: id });

	const entries =
		entry && !item ? { ...state.entries, [id]: entry } : state.entries;
	let next: TabSetState = { ...state, entries };

	if (!options.transient) {
		const pinned = isPinned(next, catalog, id);
		next = pinned ? next : pin(next, id);
		return step({ ...next, active: id }, { pinsChanged: !pinned });
	}

	if (isPinned(next, catalog, id) || next.transient === id) {
		return step({ ...next, active: id });
	}

	// One transient tab: whatever held the slot leaves and is forgotten.
	const evicted = next.transient ? [next.transient] : [];
	next = {
		...next,
		transient: id,
		active: id,
		entries: withoutEntries(next.entries, evicted),
	};
	return step(next, { evicted });
}

/**
 * Pinning keeps an item; unpinning the active one leaves it on screen as the
 * transient tab (evicting the previous transient), unpinning anything else
 * takes it off the screen.
 */
export function togglePin(
	state: TabSetState,
	catalog: Catalog,
	id: string,
	options: TabSetOptions,
): TabStep {
	if (!isPinned(state, catalog, id)) {
		return step(pin(state, id), { pinsChanged: true });
	}

	let next = unpin(state, catalog, id);
	if (!options.transient) {
		next = {
			...next,
			active:
				next.active === id
					? fallback(state, catalog, options, id)
					: next.active,
			entries: withoutEntries(next.entries, [id]),
		};
		return step(next, { evicted: [id], pinsChanged: true });
	}

	if (state.active === id) {
		const evicted =
			next.transient && next.transient !== id ? [next.transient] : [];
		next = {
			...next,
			transient: id,
			entries: withoutEntries(next.entries, evicted),
		};
		return step(next, { evicted, pinsChanged: true });
	}

	next = { ...next, entries: withoutEntries(next.entries, [id]) };
	return step(next, { evicted: [id], pinsChanged: true });
}

/** Closing takes the item off the screen and out of the pins. */
export function closeTab(
	state: TabSetState,
	catalog: Catalog,
	id: string,
	options: TabSetOptions,
): TabStep {
	const pinned = isPinned(state, catalog, id);
	if (!pinned && state.transient !== id) return step(state);

	let next = pinned ? unpin(state, catalog, id) : state;
	next = {
		...next,
		transient: next.transient === id ? null : next.transient,
		entries: withoutEntries(next.entries, [id]),
	};
	if (state.active !== id)
		return step(next, { evicted: [id], pinsChanged: pinned });

	const target = fallback(next, catalog, options, id);
	next = { ...next, active: target };
	// Home the user unpinned is still home: it comes back as the transient tab
	// rather than being active and invisible.
	if (
		target &&
		options.transient &&
		!visibleIds(next, catalog).includes(target)
	) {
		next = { ...next, transient: target };
	}
	return step(next, { evicted: [id], pinsChanged: pinned });
}

/**
 * Leaves nothing but the pins: navigation home, or a place being forgotten.
 * Labels of pinned records survive — without them the pin cannot be shown.
 */
export function resetTabSet(state: TabSetState): TabSetState {
	const kept = Object.fromEntries(
		Object.entries(state.entries).filter(([id]) => state.pins[id] === true),
	);
	return { ...state, transient: null, active: null, entries: kept };
}

export function layoutOf(state: TabSetState): PinLayout {
	const pinned = state.order.filter((id) => state.pins[id] === true);
	const unordered = Object.keys(state.pins)
		.filter((id) => state.pins[id] === true && !pinned.includes(id))
		.sort();
	return {
		pinned: [...pinned, ...unordered],
		unpinned: Object.keys(state.pins)
			.filter((id) => state.pins[id] === false)
			.sort(),
	};
}

export function pinsOf(layout: PinLayout | undefined): TabSetState["pins"] {
	return {
		...Object.fromEntries((layout?.unpinned ?? []).map((id) => [id, false])),
		...Object.fromEntries((layout?.pinned ?? []).map((id) => [id, true])),
	};
}

/** Replaces the pins with a stored layout, keeping what is open. */
export function restoreLayout(
	state: TabSetState,
	layout: PinLayout,
): TabSetState {
	const pins = pinsOf(layout);
	return {
		...state,
		pins,
		order: layout.pinned,
		transient:
			state.transient && pins[state.transient] === true
				? null
				: state.transient,
	};
}

/**
 * A stored layout combined with pins made before it arrived — by a guest who
 * then signed in, or while the answer was on its way. Local choices are newer.
 */
export function mergeLayouts(stored: PinLayout, local: PinLayout): PinLayout {
	const pins = { ...pinsOf(stored), ...pinsOf(local) };
	const order = [
		...stored.pinned.filter((id) => pins[id] === true),
		...local.pinned.filter((id) => !stored.pinned.includes(id)),
	];
	return {
		pinned: order,
		unpinned: Object.keys(pins)
			.filter((id) => pins[id] === false)
			.sort(),
	};
}

export const sameLayout = (left: PinLayout, right: PinLayout): boolean =>
	left.pinned.join(" ") === right.pinned.join(" ") &&
	left.unpinned.join(" ") === right.unpinned.join(" ");

/**
 * Case-insensitive match of every word of the query against the item's label,
 * description and group — "заказ созд" finds "Создать заказ".
 */
export function matchesQuery(item: CatalogItem, query: string): boolean {
	const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;
	const text = [item.label, item.description, item.group]
		.filter(Boolean)
		.join(" ")
		.toLocaleLowerCase();
	return words.every((word) => text.includes(word));
}
