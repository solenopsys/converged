import {
	combine,
	createEvent,
	createStore,
	type Event,
	type EventCallable,
	is,
	type Store,
	sample,
} from "effector";
import {
	type CatalogEntry,
	type CatalogItem,
	catalogEntries,
	closeTab,
	defaultTabSetOptions,
	emptyTabSet,
	layoutOf,
	openTab,
	type PinLayout,
	resetTabSet,
	restoreLayout,
	type TabEntry,
	type TabSetOptions,
	type TabSetState,
	type TabStep,
	type TabView,
	tabViews,
	togglePin,
} from "./model";

// The rule from `model.ts` as effector units.
//
// A scoped set keeps one tab set per scope — one per surface for the bar inside
// it — and exposes the *current* scope as ready-made stores plus events already
// bound to it, so a component never has to know which scope it is drawing. A
// plain set is the same thing with one scope; it is not a second
// implementation.

export type Catalogs = Readonly<Record<string, readonly CatalogItem[]>>;

export type ScopedId = { scope: string; id: string };
export type ScopedOpen = ScopedId & { entry?: TabEntry };

/** The part a tab bar draws and drives. Every tabbed place provides it. */
export type TabSetUnits = {
	$tabs: Store<TabView[]>;
	$entries: Store<CatalogEntry[]>;
	$active: Store<string | null>;
	opened: EventCallable<string>;
	pinToggled: EventCallable<string>;
	closed: EventCallable<string>;
};

export type ScopedTabSet = {
	$states: Store<Readonly<Record<string, TabSetState>>>;
	/** Every scope's persisted part. */
	$layouts: Store<Readonly<Record<string, PinLayout>>>;
	open: EventCallable<ScopedOpen>;
	togglePin: EventCallable<ScopedId>;
	close: EventCallable<ScopedId>;
	layoutRestored: EventCallable<{ scope: string; layout: PinLayout }>;
	/** Forgets what is open in these scopes; their pins stay. */
	scopesForgotten: EventCallable<readonly string[]>;
	/** Forgets what is open everywhere; pins stay. */
	reset: EventCallable<void>;
	/** Pins go too: a different person is at the keyboard. */
	cleared: EventCallable<void>;
	/** Left the screen and are forgotten; what they held can be released. */
	evicted: Event<{ scope: string; ids: string[] }>;
	commandChosen: Event<ScopedId>;
	pinsChanged: Event<{ scope: string; layout: PinLayout }>;
	/** The current scope, bound. */
	current: TabSetUnits;
};

export type TabSet = TabSetUnits & {
	$state: Store<TabSetState>;
	$layout: Store<PinLayout>;
	/** Opens something the catalog does not list, under its own label. */
	openEntry: EventCallable<TabEntry>;
	layoutRestored: EventCallable<PinLayout>;
	reset: EventCallable<void>;
	cleared: EventCallable<void>;
	evicted: Event<string[]>;
	commandChosen: Event<string>;
	pinsChanged: Event<PinLayout>;
};

type ScopedOptions = {
	name: string;
	$catalogs: Store<Catalogs>;
	/** Which scope `current` draws; null draws nothing. */
	$scope: Store<string | null>;
} & Partial<TabSetOptions>;

const NO_CATALOG: readonly CatalogItem[] = [];

const stateOf = (
	states: Readonly<Record<string, TabSetState>>,
	scope: string,
): TabSetState => states[scope] ?? emptyTabSet;

export function createScopedTabSet({
	name,
	$catalogs,
	$scope,
	...overrides
}: ScopedOptions): ScopedTabSet {
	const options: TabSetOptions = { ...defaultTabSetOptions, ...overrides };

	const open = createEvent<ScopedOpen>(`${name}_OPEN`);
	const togglePinEvent = createEvent<ScopedId>(`${name}_TOGGLE_PIN`);
	const close = createEvent<ScopedId>(`${name}_CLOSE`);
	const layoutRestored = createEvent<{ scope: string; layout: PinLayout }>(
		`${name}_LAYOUT_RESTORED`,
	);
	const scopesForgotten = createEvent<readonly string[]>(
		`${name}_SCOPES_FORGOTTEN`,
	);
	const reset = createEvent(`${name}_RESET`);
	const cleared = createEvent(`${name}_CLEARED`);
	const stepped = createEvent<TabStep & { scope: string }>(`${name}_STEPPED`);

	const $states = createStore<Readonly<Record<string, TabSetState>>>(
		{},
		{ name: `${name}_STATES` },
	)
		.on(stepped, (states, { scope, state }) =>
			states[scope] === state ? states : { ...states, [scope]: state },
		)
		.on(layoutRestored, (states, { scope, layout }) => ({
			...states,
			[scope]: restoreLayout(stateOf(states, scope), layout),
		}))
		.on(scopesForgotten, (states, scopes) => {
			const known = scopes.filter((scope) => states[scope]);
			if (known.length === 0) return states;
			const next = { ...states };
			for (const scope of known) next[scope] = resetTabSet(states[scope]);
			return next;
		})
		.on(reset, (states) =>
			Object.fromEntries(
				Object.entries(states).map(([scope, state]) => [
					scope,
					resetTabSet(state),
				]),
			),
		)
		.reset(cleared);

	const source = { states: $states, catalogs: $catalogs };
	const transition = <T extends ScopedId>(
		clock: Event<T>,
		run: (
			state: TabSetState,
			catalog: readonly CatalogItem[],
			payload: T,
		) => TabStep,
	) =>
		sample({
			clock,
			source,
			fn: ({ states, catalogs }, payload) => ({
				scope: payload.scope,
				...run(
					stateOf(states, payload.scope),
					catalogs[payload.scope] ?? NO_CATALOG,
					payload,
				),
			}),
			target: stepped,
		});

	transition(open, (state, catalog, { id, entry }) =>
		openTab(state, catalog, id, entry, options),
	);
	transition(togglePinEvent, (state, catalog, { id }) =>
		togglePin(state, catalog, id, options),
	);
	transition(close, (state, catalog, { id }) =>
		closeTab(state, catalog, id, options),
	);

	const evicted = stepped.filterMap(({ scope, evicted: ids }) =>
		ids.length > 0 ? { scope, ids } : undefined,
	);

	const commandChosen = stepped.filterMap(({ scope, command }) =>
		command ? { scope, id: command } : undefined,
	);
	const pinsChanged = stepped.filterMap(({ scope, state, pinsChanged }) =>
		pinsChanged ? { scope, layout: layoutOf(state) } : undefined,
	);

	const $layouts = $states.map((states) =>
		Object.fromEntries(
			Object.entries(states).map(([scope, state]) => [scope, layoutOf(state)]),
		),
	);

	const $currentState = combine($states, $scope, (states, scope) =>
		scope === null ? emptyTabSet : stateOf(states, scope),
	);
	const $currentCatalog = combine($catalogs, $scope, (catalogs, scope) =>
		scope === null ? NO_CATALOG : (catalogs[scope] ?? NO_CATALOG),
	);

	const bind = (
		target: EventCallable<ScopedId>,
		label: string,
	): EventCallable<string> => {
		const bound = createEvent<string>(`${name}_CURRENT_${label}`);
		sample({
			clock: bound,
			source: $scope,
			filter: (scope): scope is string => scope !== null,
			fn: (scope, id) => ({ scope: scope as string, id }),
			target,
		});
		return bound;
	};

	return {
		$states,
		$layouts,
		open,
		togglePin: togglePinEvent,
		close,
		layoutRestored,
		scopesForgotten,
		reset,
		cleared,
		evicted,
		commandChosen,
		pinsChanged,
		current: {
			$tabs: combine($currentState, $currentCatalog, tabViews),
			$entries: combine($currentState, $currentCatalog, catalogEntries),
			$active: $currentState.map((state) => state.active),
			opened: bind(open, "OPEN"),
			pinToggled: bind(togglePinEvent, "TOGGLE_PIN"),
			closed: bind(close, "CLOSE"),
		},
	};
}

const SCOPE = "";

type TabSetConfig = {
	name: string;
	$catalog: Store<readonly CatalogItem[]> | readonly CatalogItem[];
} & Partial<TabSetOptions>;

/** One tabbed place: the scoped set with a single scope. */
export function createTabSet({
	name,
	$catalog,
	...options
}: TabSetConfig): TabSet {
	const catalog = is.store($catalog)
		? ($catalog as Store<readonly CatalogItem[]>)
		: createStore($catalog as readonly CatalogItem[], {
				name: `${name}_CATALOG`,
			});
	const scoped = createScopedTabSet({
		name,
		$catalogs: catalog.map((items): Catalogs => ({ [SCOPE]: items })),
		$scope: createStore<string | null>(SCOPE, { name: `${name}_SCOPE` }),
		...options,
	});

	const openEntry = createEvent<TabEntry>(`${name}_OPEN_ENTRY`);
	sample({
		clock: openEntry,
		fn: (entry) => ({ scope: SCOPE, id: entry.id, entry }),
		target: scoped.open,
	});
	const layoutRestored = createEvent<PinLayout>(`${name}_LAYOUT_RESTORE`);
	sample({
		clock: layoutRestored,
		fn: (layout) => ({ scope: SCOPE, layout }),
		target: scoped.layoutRestored,
	});

	const $state = scoped.$states.map((states) => stateOf(states, SCOPE));

	return {
		...scoped.current,
		$state,
		$layout: $state.map(layoutOf),
		openEntry,
		layoutRestored,
		reset: scoped.reset,
		cleared: scoped.cleared,
		evicted: scoped.evicted.map(({ ids }) => ids),
		commandChosen: scoped.commandChosen.map(({ id }) => id),
		pinsChanged: scoped.pinsChanged.map(({ layout }) => layout),
	};
}
