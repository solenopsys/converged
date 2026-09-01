import type { Store } from "effector";
import { createEvent, createStore } from "effector";
import { useUnit } from "effector-preact";
import type * as React from "preact/compat";
import { useEffect, useMemo, useState } from "preact/compat";
import type {
	HeaderAction,
	HeaderPanelConfig,
	SelectionAction,
} from "../components/HeaderPanel";
import { HeaderPanelLayout } from "../components/HeaderPanelLayout";
import { RefreshCw } from "../icons";
import type {
	TableFilterConfig,
	TableFilterValues,
} from "../table/filter-header";
import { valuesFromSelectionFilter } from "../table/filter-header";
import { InfiniteScrollDataTable } from "../table/InfiniteScrollDataTable";
import type { InfiniteTableStore } from "../table/infinite-table-store";
import type {
	BulkAction,
	ColumnConfig,
	RowCardProps,
	RowId,
	ViewMode,
} from "../table/types";

export type EntityListTab<TData extends object = Record<string, unknown>> = {
	id: string;
	label: string;
	badge?: string | number;

	store?: InfiniteTableStore;

	filters?: TableFilterValues;
	columns?: Array<ColumnConfig<TData>>;
	CardComponent?: React.ComponentType<RowCardProps<TData>> | null;
	emptyMessage?: string;
};

export interface EntityListViewProps<
	TData extends object = Record<string, unknown>,
> {
	tableId: string;
	store?: InfiniteTableStore;
	columns: Array<ColumnConfig<TData>>;
	title?: string;
	subtitle?: string;

	actions?: HeaderAction[];
	selectionActions?: SelectionAction[];
	refreshable?: boolean;
	refreshLabel?: string;

	filters?: TableFilterConfig[];

	baseFilters?: TableFilterValues;
	serializeFilters?: (
		values: TableFilterValues,
		baseFilters: TableFilterValues | undefined,
	) => TableFilterValues;
	tabs?: Array<EntityListTab<TData>>;

	$activeTab?: Store<string>;
	tabChanged?: (tabId: string) => void;
	onRowClick?: (rowData: TData) => void;
	CardComponent?: React.ComponentType<RowCardProps<TData>> | null;
	viewMode?: ViewMode;
	selectable?: boolean;
	bulkActions?: BulkAction[];
	onBulkAction?: (actionId: string, rows: TData[], rowIds: RowId[]) => void;
	emptyMessage?: string;
	className?: string;
}

const cleanFilters = (values: TableFilterValues): TableFilterValues => {
	const result: TableFilterValues = {};
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined || value === null || value === "") continue;
		result[key] = value;
	}
	return result;
};

export function EntityListView<TData extends object = Record<string, unknown>>({
	tableId,
	store,
	columns,
	title,
	subtitle,
	actions,
	selectionActions,
	refreshable = true,
	refreshLabel = "Refresh",
	filters,
	baseFilters,
	serializeFilters,
	tabs,
	$activeTab,
	tabChanged,
	onRowClick,
	CardComponent,
	viewMode = "table",
	selectable = true,
	bulkActions,
	onBulkAction,
	emptyMessage,
	className,
}: EntityListViewProps<TData>) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: tab state must be created once per instance
	const internalTabState = useMemo(() => {
		const changed = createEvent<string>();
		const $active = createStore(tabs?.[0]?.id ?? "").on(
			changed,
			(_, value) => value,
		);
		return { $active, changed };
	}, []);

	const $tab = $activeTab ?? internalTabState.$active;
	const onTabChanged = tabChanged ?? internalTabState.changed;
	const activeTabId = useUnit($tab);

	const activeTab = tabs?.find((tab) => tab.id === activeTabId) ?? tabs?.[0];
	const activeStore = activeTab?.store ?? store;
	if (!activeStore) {
		throw new Error(
			`EntityListView(${tableId}): no store — pass "store" or per-tab "store"`,
		);
	}

	const state = useUnit(activeStore.$state);
	const [filterValues, setFilterValues] = useState<TableFilterValues>({});
	const selectionFilterValues = useMemo(
		() => valuesFromSelectionFilter(filters, baseFilters),
		[baseFilters, filters],
	);
	const displayedFilterValues = useMemo(
		() => ({ ...selectionFilterValues, ...filterValues }),
		[filterValues, selectionFilterValues],
	);

	const mergedFilters = useMemo(() => {
		const values = cleanFilters({ ...activeTab?.filters, ...filterValues });
		return serializeFilters
			? cleanFilters(serializeFilters(values, baseFilters))
			: cleanFilters({ ...baseFilters, ...values });
	}, [activeTab?.filters, baseFilters, filterValues, serializeFilters]);

	// Push filters into the store only when they actually differ; setFilters
	// resets pagination and triggers a reload by itself.
	useEffect(() => {
		const current = activeStore.$state.getState().filters;
		if (JSON.stringify(current) !== JSON.stringify(mergedFilters)) {
			activeStore.setFilters(mergedFilters);
		}
	}, [activeStore, mergedFilters]);

	// Initial load for the active store (also covers switching to a fresh tab).
	useEffect(() => {
		const current = activeStore.$state.getState();
		if (!current.isInitialized && !current.loading && !current.loadingMore) {
			activeStore.loadMore({});
		}
	}, [activeStore]);

	const headerConfig: HeaderPanelConfig = {
		title,
		subtitle,
		...(tabs && tabs.length > 0
			? {
					tabs: tabs.map((tab) => ({
						id: tab.id,
						label: tab.label,
						value: tab.id,
						badge: tab.badge,
					})),
					$activeTab: $tab,
					tabChanged: onTabChanged,
				}
			: {}),
		actions: [
			...(actions ?? []),
			...(refreshable
				? [
						{
							id: "__list_refresh",
							label: refreshLabel,
							icon: RefreshCw,
							event: activeStore.refresh,
							variant: "outline" as const,
						},
					]
				: []),
		],
		selectionActions,
	};

	const handleSort = (columnId: string, direction: "asc" | "desc") => {
		activeStore.setSort({ key: columnId, direction });
	};

	return (
		<HeaderPanelLayout config={headerConfig} className={className}>
			<div className="min-h-0 flex-1">
				<InfiniteScrollDataTable<TData>
					tableId={tabs ? `${tableId}:${activeTabId}` : tableId}
					columns={activeTab?.columns ?? columns}
					data={state.items as TData[]}
					hasMore={state.hasMore}
					loading={state.loading}
					loadingMore={state.loadingMore}
					totalCount={state.totalCount}
					sortConfig={state.sortConfig}
					onSort={handleSort}
					onLoadMore={activeStore.loadMore}
					onRowClick={onRowClick}
					CardComponent={activeTab?.CardComponent ?? CardComponent}
					viewMode={viewMode}
					selectable={selectable}
					bulkActions={bulkActions}
					onBulkAction={onBulkAction}
					emptyMessage={activeTab?.emptyMessage ?? emptyMessage}
					filters={filters}
					filterValues={displayedFilterValues}
					onFilterValuesChange={setFilterValues}
				/>
			</div>
		</HeaderPanelLayout>
	);
}
