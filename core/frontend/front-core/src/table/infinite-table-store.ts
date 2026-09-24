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
	error: string | null;
	offset: number;
	limit: number;
	hasMore: boolean;
	sortConfig: InfiniteTableSortConfig;
	filters: InfiniteTableFilters;
	header: InfiniteTableHeaderState;
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
	}));

type TableController<TItem> = {
	$state: Store<InfiniteTableState<TItem>>;
	$activeTab: Store<string>;
	loadMore: EventCallable<Record<string, unknown> | void>;
	setSort: EventCallable<InfiniteTableSortConfig>;
	setFilters: EventCallable<InfiniteTableFilters>;
	setHeader: EventCallable<Partial<InfiniteTableHeaderState>>;
	refresh: EventCallable<void>;
	reset: EventCallable<void>;
	loadDataFx: Effect<
		Record<string, unknown>,
		{ items: TItem[]; totalCount?: number; limit: number; append: boolean },
		Error
	>;
};

const controllers = new Map<string, TableController<unknown>>();
const dataSources = new Map<string, InfiniteTableDataFunction<unknown>>();
let nextGeneratedKey = 1;

// biome-ignore lint/suspicious/noExplicitAny: legacy call sites pass untyped rows
export const createInfiniteTableStore = <TItem = any>(
	domain: Domain,
	dataFunction: InfiniteTableDataFunction<TItem>,
	stableKey?: string,
) => {
	const key = stableKey ? `table:${stableKey}` : `domain:${nextGeneratedKey++}`;

	const existing = controllers.get(key);
	if (existing) {
		dataSources.set(key, dataFunction as InfiniteTableDataFunction<unknown>);
		return existing as TableController<TItem>;
	}

	dataSources.set(key, dataFunction as InfiniteTableDataFunction<unknown>);
	const loadDataFx = domain.createEffect<
		Record<string, unknown>,
		{ items: TItem[]; totalCount?: number; limit: number; append: boolean }
	>({
		name: "LOAD_DATA_INFINITE",
		handler: async (params: Record<string, unknown>) => {
			const {
				offset = 0,
				limit = 20,
				sortBy,
				sortDirection,
				append = false,
				...filters
			} = params || {};

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

			return {
				items: result?.items || [],
				totalCount: result?.totalCount,
				limit: limit as number,
				append: Boolean(append),
			};
		},
	});

	// biome-ignore lint/suspicious/noConfusingVoidType: event is called with no payload from onLoadMore callbacks
	const loadMore = domain.createEvent<Record<string, unknown> | void>(
		"LOAD_MORE_EVENT",
	);
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
		fn: (state, { items, totalCount, limit, append }) => {
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

	sample({
		clock: loadMore,
		source: $state,
		filter: (state) => !state.loading && !state.loadingMore && state.hasMore,
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
