import {
	combine,
	createEvent,
	createStore,
	type Domain,
	type Effect,
	type EventCallable,
	type Store,
	sample,
} from "effector";

export type InfiniteTableSortConfig = {
	key: string | null;
	direction: "asc" | "desc";
};

export type InfiniteTableFilters = Record<string, unknown>;

export type InfiniteTableHeaderState = {
	filterValues: Record<string, unknown>;
	selectedIds: Array<string | number>;
	activeTabId: string;
	referenceKey: string;
};

// biome-ignore lint/suspicious/noExplicitAny: legacy call sites pass untyped rows
export type InfiniteTableState<TItem = any> = {
	items: TItem[];
	totalCount: number;
	loading: boolean;
	loadingMore: boolean;
	loadingAll: boolean;
	loadAllFailed: boolean;
	error: string | null;
	offset: number;
	limit: number;
	hasMore: boolean;
	sortConfig: InfiniteTableSortConfig;
	filters: InfiniteTableFilters;
	header: InfiniteTableHeaderState;
	scrollPositions: Record<string, number>;
	isInitialized: boolean;
};

// biome-ignore lint/suspicious/noExplicitAny: legacy call sites pass untyped rows
export type InfiniteTableDataFunction<TItem = any> = (params: {
	limit: number;
	offset: number;
	sortBy?: string;
	sortDirection?: "asc" | "desc";
	[filter: string]: unknown;
}) => Promise<{ items?: TItem[]; totalCount?: number } | null | undefined>;

const initialState: InfiniteTableState = {
	items: [],
	totalCount: 0,
	loading: false,
	loadingMore: false,
	loadingAll: false,
	loadAllFailed: false,
	error: null,
	offset: 0,
	limit: 20,
	hasMore: true,
	sortConfig: { key: null, direction: "asc" },
	filters: {},
	header: {
		filterValues: {},
		selectedIds: [],
		activeTabId: "",
		referenceKey: "",
	},
	scrollPositions: {},
	isInitialized: false,
};

type TableMap = Record<string, InfiniteTableState>;
const tableStateCreated = createEvent<{ key: string }>(
	"INFINITY_TABLE_CREATED",
);
const tableStateChanged = createEvent<{
	key: string;
	state: InfiniteTableState;
}>("INFINITY_TABLE_STATE_CHANGED");
const tableScrollPositionChanged = createEvent<{
	stateKey: string;
	tableId: string;
	scrollTop: number;
}>("INFINITY_TABLE_SCROLL_POSITION_CHANGED");

/** All visited infinity tables and their state, keyed by stable projection identity. */
export const $infinityTables = createStore<TableMap>(
	{},
	{ name: "INFINITY_TABLES" },
)
	.on(tableStateCreated, (tables, { key }) =>
		tables[key] ? tables : { ...tables, [key]: initialState },
	)
	.on(tableStateChanged, (tables, { key, state }) => ({
		...tables,
		[key]: state,
	}))
	.on(
		tableScrollPositionChanged,
		(tables, { stateKey, tableId, scrollTop }) => {
			const state = tables[stateKey] ?? initialState;
			const position = Math.max(0, scrollTop);
			if (Math.abs((state.scrollPositions[tableId] ?? 0) - position) < 4)
				return tables;
			return {
				...tables,
				[stateKey]: {
					...state,
					scrollPositions: { ...state.scrollPositions, [tableId]: position },
				},
			};
		},
	);

type TableController<TItem> = {
	$state: Store<InfiniteTableState<TItem>>;
	$activeTab: Store<string>;
	loadMore: EventCallable<Record<string, unknown> | void>;
	loadAll: EventCallable<void>;
	setSort: EventCallable<InfiniteTableSortConfig>;
	setFilters: EventCallable<InfiniteTableFilters>;
	setHeader: EventCallable<Partial<InfiniteTableHeaderState>>;
	refresh: EventCallable<void>;
	reset: EventCallable<void>;
	loadDataFx: Effect<
		Record<string, unknown>,
		{
			items: TItem[];
			totalCount?: number;
			limit: number;
			append: boolean;
			queryKey: string;
		},
		Error
	>;
};

const controllers = new Map<string, TableController<unknown>>();
const dataSources = new Map<string, InfiniteTableDataFunction<unknown>>();
const tableKeysById = new Map<string, string>();
const scrollPositionStores = new Map<string, Store<number>>();
let nextGeneratedKey = 1;
const LOAD_ALL_PAGE_SIZE = 100;

function registerTableAlias(stableKey: string, stateKey: string): void {
	tableKeysById.set(stableKey, stateKey);
	try {
		const parsed: unknown = JSON.parse(stableKey);
		if (parsed && typeof parsed === "object") {
			const tableId = (parsed as { tableId?: unknown }).tableId;
			if (typeof tableId === "string") tableKeysById.set(tableId, stateKey);
		}
	} catch {
		// Simple stable keys are also the renderer's table id.
	}
}

function tableStateKey(tableId: string): string {
	const exact = tableKeysById.get(tableId);
	if (exact) return exact;
	const alias = [...tableKeysById.keys()]
		.filter((candidate) => tableId.startsWith(`${candidate}:`))
		.sort((left, right) => right.length - left.length)[0];
	if (alias) return tableKeysById.get(alias)!;
	const key = `table:${tableId}`;
	tableKeysById.set(tableId, key);
	return key;
}

/** A cached selector into the one shared Infinity state map. */
export function infinityTableScrollPosition(tableId: string): Store<number> {
	const stateKey = tableStateKey(tableId);
	const selectorKey = `${stateKey}:${tableId}`;
	const existing = scrollPositionStores.get(selectorKey);
	if (existing) return existing;
	const $position = combine(
		$infinityTables,
		(tables) => tables[stateKey]?.scrollPositions[tableId] ?? 0,
	);
	scrollPositionStores.set(selectorKey, $position);
	return $position;
}

export function setInfinityTableScrollPosition(
	tableId: string,
	scrollTop: number,
): void {
	tableScrollPositionChanged({
		stateKey: tableStateKey(tableId),
		tableId,
		scrollTop,
	});
}

// biome-ignore lint/suspicious/noExplicitAny: legacy call sites pass untyped rows
export const createInfiniteTableStore = <TItem = any>(
	domain: Domain,
	dataFunction: InfiniteTableDataFunction<TItem>,
	stableKey?: string,
) => {
	const key = stableKey ? `table:${stableKey}` : `domain:${nextGeneratedKey++}`;
	if (stableKey) registerTableAlias(stableKey, key);

	const existing = controllers.get(key);
	if (existing) {
		dataSources.set(key, dataFunction as InfiniteTableDataFunction<unknown>);
		return existing as TableController<TItem>;
	}

	dataSources.set(key, dataFunction as InfiniteTableDataFunction<unknown>);
	const loadDataFx = domain.createEffect<
		Record<string, unknown>,
		{
			items: TItem[];
			totalCount?: number;
			limit: number;
			append: boolean;
			queryKey: string;
		}
	>({
		name: "LOAD_DATA_INFINITE",
		handler: async (params: Record<string, unknown>) => {
			const effectParams = { ...params };
			delete effectParams.__loadAllPage;
			const {
				offset = 0,
				limit = 20,
				sortBy,
				sortDirection,
				append = false,
				...filters
			} = effectParams;

			const result = (await dataSources.get(key)!({
				limit: limit as number,
				offset: offset as number,
				...(sortBy
					? {
							sortBy: sortBy as string,
							sortDirection: sortDirection as "asc" | "desc",
						}
					: {}),
				...filters,
			})) as { items?: TItem[]; totalCount?: number } | null | undefined;
			const queryKey = JSON.stringify({
				sortBy: sortBy ?? null,
				sortDirection: sortDirection ?? "asc",
				filters,
			});

			return {
				items: result?.items || [],
				totalCount: result?.totalCount,
				limit: limit as number,
				append: Boolean(append),
				queryKey,
			};
		},
	});

	// biome-ignore lint/suspicious/noConfusingVoidType: event is called with no payload from onLoadMore callbacks
	const loadMore = domain.createEvent<Record<string, unknown> | void>(
		"LOAD_MORE_EVENT",
	);
	const loadAll = domain.createEvent<void>("LOAD_ALL_EVENT");
	const setSort = domain.createEvent<InfiniteTableSortConfig>(
		"SET_SORT_INFINITE_EVENT",
	);
	const setFilters =
		domain.createEvent<InfiniteTableFilters>("SET_FILTERS_EVENT");
	const setHeader = domain.createEvent<Partial<InfiniteTableHeaderState>>(
		"SET_HEADER_STATE_EVENT",
	);
	const refresh = domain.createEvent("REFRESH_INFINITE_EVENT");
	const reset = domain.createEvent("RESET_INFINITE_EVENT");
	const stateChanged = domain.createEvent<InfiniteTableState<TItem>>(
		"TABLE_STATE_CHANGED",
	);

	tableStateCreated({ key });
	const $state = combine(
		$infinityTables,
		(tables) => (tables[key] ?? initialState) as InfiniteTableState<TItem>,
	);
	const $activeTab = $state.map((state) => state.header.activeTabId);
	sample({
		clock: stateChanged,
		fn: (state) => ({ key, state }),
		target: tableStateChanged,
	});

	sample({
		clock: setSort,
		source: $state,
		fn: (state, sortConfig) => ({
			...state,
			sortConfig,
			items: [],
			offset: 0,
			hasMore: true,
		}),
		target: stateChanged,
	});

	sample({
		clock: setFilters,
		source: $state,
		fn: (state, filters) => ({
			...state,
			filters,
			items: [],
			totalCount: 0,
			offset: 0,
			hasMore: true,
			isInitialized: false,
		}),
		target: stateChanged,
	});

	sample({
		clock: setHeader,
		source: $state,
		fn: (state, header) => ({
			...state,
			header: { ...state.header, ...header },
			loadAllFailed: false,
		}),
		target: stateChanged,
	});

	sample({
		clock: loadDataFx.pending,
		source: $state,
		fn: (state, pending) => ({
			...state,
			loading: pending && state.items.length === 0,
			loadingMore: pending && state.items.length > 0,
		}),
		target: stateChanged,
	});

	sample({
		clock: loadDataFx.doneData,
		source: $state,
		fn: (state, { items, totalCount, limit, append, queryKey }) => {
			const activeQueryKey = JSON.stringify({
				sortBy: state.sortConfig.key,
				sortDirection: state.sortConfig.direction,
				filters: state.filters,
			});
			if (queryKey !== activeQueryKey) return state;
			const newItems = append ? [...state.items, ...items] : items;
			const hasTotalCount = typeof totalCount === "number";
			return {
				...state,
				items: newItems,
				totalCount: hasTotalCount ? totalCount : newItems.length,
				offset: newItems.length,
				hasMore: hasTotalCount
					? newItems.length < totalCount
					: items.length >= limit,
				loading: false,
				loadingMore: false,
				error: null,
				isInitialized: true,
			};
		},
		target: stateChanged,
	});

	sample({
		clock: loadDataFx.failData,
		source: $state,
		fn: (state, error) => ({
			...state,
			error: error.message,
			loading: false,
			loadingMore: false,
		}),
		target: stateChanged,
	});

	sample({
		clock: reset,
		fn: () => ({ key, state: initialState }),
		target: tableStateChanged,
	});

	const requestParams = (state: InfiniteTableState<TItem>, offset: number) => ({
		offset,
		limit: state.limit,
		sortBy: state.sortConfig.key ?? undefined,
		sortDirection: state.sortConfig.direction,
		append: offset > 0,
		...state.filters,
	});
	const stateQueryKey = (state: InfiniteTableState<TItem>) =>
		JSON.stringify({
			sortBy: state.sortConfig.key,
			sortDirection: state.sortConfig.direction,
			filters: state.filters,
		});

	const loadAllFx = domain.createEffect<void, void>({
		name: "LOAD_ALL_INFINITE",
		handler: async () => {
			const initialQueryKey = stateQueryKey($state.getState());
			while (true) {
				let state = $state.getState();
				if (stateQueryKey(state) !== initialQueryKey) return;
				if (!state.hasMore) return;

				if (state.loading || state.loadingMore) {
					await new Promise<void>((resolve) => {
						let stop = () => {};
						stop = loadDataFx.finally.watch(() => {
							stop();
							resolve();
						});
					});
					state = $state.getState();
					if (stateQueryKey(state) !== initialQueryKey) return;
					if (state.error) throw new Error(state.error);
					continue;
				}

				const offset = state.items.length;
				let pageLimit = Math.max(state.limit, LOAD_ALL_PAGE_SIZE);
				if (state.totalCount > offset) {
					pageLimit = Math.min(state.totalCount - offset, pageLimit);
				}
				await new Promise<void>((resolve, reject) => {
					let stopDone = () => {};
					let stopFail = () => {};
					const cleanup = () => {
						stopDone();
						stopFail();
					};
					stopDone = loadDataFx.done.watch(({ params }) => {
						if (!params.__loadAllPage) return;
						cleanup();
						resolve();
					});
					stopFail = loadDataFx.fail.watch(({ params, error }) => {
						if (!params.__loadAllPage) return;
						cleanup();
						reject(error);
					});
					loadMore({ limit: pageLimit, __loadAllPage: true });
				});
				const nextState = $state.getState();
				if (stateQueryKey(nextState) !== initialQueryKey) return;
				if (nextState.items.length <= offset) return;
			}
		},
	});

	sample({
		clock: loadAll,
		filter: () => !loadAllFx.pending.getState(),
		target: loadAllFx,
	});

	sample({
		clock: loadAllFx.pending,
		source: $state,
		filter: (_, loadingAll) => loadingAll,
		fn: (state) => ({ ...state, loadingAll: true, loadAllFailed: false }),
		target: stateChanged,
	});

	sample({
		clock: loadAllFx.done,
		source: $state,
		fn: (state) => ({ ...state, loadingAll: false, loadAllFailed: false }),
		target: stateChanged,
	});

	sample({
		clock: loadAllFx.failData,
		source: $state,
		fn: (state) => ({ ...state, loadingAll: false, loadAllFailed: true }),
		target: stateChanged,
	});

	sample({
		clock: loadMore,
		source: $state,
		filter: (state, params) =>
			!state.loading &&
			!state.loadingMore &&
			(!state.loadingAll || Boolean(params && params.__loadAllPage)) &&
			state.hasMore,
		fn: (state, params) => ({
			...requestParams(state, state.items.length),
			...(params ?? {}),
		}),
		target: loadDataFx,
	});

	sample({
		clock: setSort,
		source: $state,
		fn: (state) => requestParams(state, 0),
		target: loadDataFx,
	});

	sample({
		clock: setFilters,
		source: $state,
		fn: (state) => requestParams(state, 0),
		target: loadDataFx,
	});

	sample({
		clock: refresh,
		source: $state,
		fn: (state) => requestParams(state, 0),
		target: loadDataFx,
	});

	const controller = {
		$state,
		$activeTab,
		loadMore,
		loadAll,
		setSort,
		setFilters,
		setHeader,
		refresh,
		reset,
		loadDataFx,
	};
	controllers.set(key, controller as TableController<unknown>);
	return controller;
};

// biome-ignore lint/suspicious/noExplicitAny: legacy call sites pass untyped rows
export type InfiniteTableStore<TItem = any> = ReturnType<
	typeof createInfiniteTableStore<TItem>
>;
