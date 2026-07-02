import type { Event, Store } from "effector";
import { createEvent, createStore } from "effector";
import { useUnit } from "effector-react";
import { RefreshCw } from "lucide-react";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import type {
	HeaderAction,
	HeaderPanelConfig,
	SelectionAction,
} from "../components/HeaderPanel";
import { HeaderPanelLayout } from "../components/HeaderPanelLayout";
import { InfiniteScrollDataTable } from "../components/ui/table/InfiniteScrollDataTable";
import type {
	BulkAction,
	ColumnConfig,
	RowCardProps,
	RowId,
	ViewMode,
} from "../components/ui/table/InfiniteScrollDataTable.types";
import {
	TableFilterBar,
	type TableFilterConfig,
	type TableFilterValues,
} from "../components/ui/table/TableFilterBar";
import type { InfiniteTableStore } from "./infinite-table-store";

export type EntityListTab<TData extends object = Record<string, unknown>> = {
	id: string;
	label: string;
	badge?: string | number;
	/** Dedicated store for this tab (multi-endpoint tabs). */
	store?: InfiniteTableStore;
	/** Server-side filters applied while the tab is active (single-store tabs). */
	filters?: TableFilterValues;
	columns?: Array<ColumnConfig<TData>>;
	CardComponent?: React.ComponentType<RowCardProps<TData>> | null;
	emptyMessage?: string;
};

export interface EntityListViewProps<
	TData extends object = Record<string, unknown>,
> {
	/** Unique id — column widths and other UI state are persisted under it. */
	tableId: string;
	store?: InfiniteTableStore;
	columns: Array<ColumnConfig<TData>>;
	title?: string;
	subtitle?: string;
	/** Extra header actions; a Refresh action is appended automatically. */
	actions?: HeaderAction[];
	selectionActions?: SelectionAction[];
	refreshable?: boolean;
	refreshLabel?: string;
	/** Declarative filter toolbar; values go to the list API via setFilters. */
	filters?: TableFilterConfig[];
	/** Fixed filters always sent with requests (e.g. parent entity id). */
	baseFilters?: TableFilterValues;
	tabs?: Array<EntityListTab<TData>>;
	/** External active-tab state; defaults to internal state. */
	$activeTab?: Store<string>;
	tabChanged?: Event<string>;
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

/**
 * Universal list screen: header (title/tabs/actions), declarative filter bar,
 * infinite-scroll table with sorting — all driven by an infinite-table store.
 * Mount loading, refresh and tab switching are handled here, so feature views
 * only supply config and data wiring.
 */
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

	const mergedFilters = useMemo(
		() =>
			cleanFilters({
				...baseFilters,
				...activeTab?.filters,
				...filterValues,
			}),
		[baseFilters, activeTab?.filters, filterValues],
	);

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
			<div className="flex h-full min-h-0 flex-col gap-3">
				{filters && filters.length > 0 && (
					<TableFilterBar
						filters={filters}
						values={filterValues}
						onChange={setFilterValues}
					/>
				)}
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
					/>
				</div>
			</div>
		</HeaderPanelLayout>
	);
}
