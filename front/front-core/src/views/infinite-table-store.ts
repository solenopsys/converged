import type { Domain } from "effector";
import { sample } from "effector";

export type InfiniteTableSortConfig = {
	key: string | null;
	direction: "asc" | "desc";
};

export type InfiniteTableFilters = Record<string, unknown>;

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
	isInitialized: false,
};

/**
 * Effector store factory for the infinite-scroll tables. Owns pagination,
 * sorting and server-side filters; `filters` are spread into every request,
 * so any param the list API accepts can be driven from the UI via setFilters.
 */
// biome-ignore lint/suspicious/noExplicitAny: legacy call sites pass untyped rows
export const createInfiniteTableStore = <TItem = any>(
	domain: Domain,
	dataFunction: InfiniteTableDataFunction<TItem>,
) => {
	const loadDataFx = domain.createEffect({
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

			const result = await dataFunction({
				limit: limit as number,
				offset: offset as number,
				...(sortBy
					? {
							sortBy: sortBy as string,
							sortDirection: sortDirection as "asc" | "desc",
						}
					: {}),
				...filters,
			});

			return {
				items: result?.items || [],
				totalCount: result?.totalCount || 0,
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
	const refresh = domain.createEvent("REFRESH_INFINITE_EVENT");
	const reset = domain.createEvent("RESET_INFINITE_EVENT");

	const $state = domain
		.createStore<InfiniteTableState<TItem>>(
			initialState as InfiniteTableState<TItem>,
		)
		.on(setSort, (state, sortConfig) => ({
			...state,
			sortConfig,
			items: [],
			offset: 0,
			hasMore: true,
		}))
		.on(setFilters, (state, filters) => ({
			...state,
			filters,
			items: [],
			offset: 0,
			hasMore: true,
			isInitialized: false,
		}))
		.on(loadDataFx.pending, (state, pending) => {
			if (state.items.length === 0 && pending) {
				return { ...state, loading: true, loadingMore: false };
			}
			if (pending) {
				return { ...state, loading: false, loadingMore: true };
			}
			return { ...state, loading: false, loadingMore: false };
		})
		.on(loadDataFx.doneData, (state, { items, totalCount, append }) => {
			const newItems = append ? [...state.items, ...items] : items;

			return {
				...state,
				items: newItems,
				totalCount: totalCount || 0,
				offset: newItems.length,
				hasMore: newItems.length < totalCount,
				loading: false,
				loadingMore: false,
				error: null,
				isInitialized: true,
			};
		})
		.on(loadDataFx.failData, (state, error) => ({
			...state,
			error: error.message,
			loading: false,
			loadingMore: false,
		}))
		.reset(reset);

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

	// Reload from scratch keeping filters/sort; unlike reset it repopulates.
	sample({
		clock: refresh,
		source: $state,
		fn: (state) => requestParams(state, 0),
		target: loadDataFx,
	});

	return { $state, loadMore, setSort, setFilters, refresh, reset, loadDataFx };
};

// biome-ignore lint/suspicious/noExplicitAny: legacy call sites pass untyped rows
export type InfiniteTableStore<TItem = any> = ReturnType<
	typeof createInfiniteTableStore<TItem>
>;
